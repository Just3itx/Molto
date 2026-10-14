local Registry = {}

--// Helpers \\--
local function Check(...)
	for index = 1, select("#", ...) do
		if typeof((select(index, ...))) ~= "function" then return false end
	end
	return true
end

local AssetManager = {}
do
	local BASE_PATH = "molto-icons"

	AssetManager.Supported = Check(isfile, isfolder, makefolder, readfile, writefile, getcustomasset)
	AssetManager.CanDelete = AssetManager.Supported and Check(listfiles, delfolder)

	function AssetManager.Path(relative: string?): string
		return if relative then `{BASE_PATH}/{relative}` else BASE_PATH
	end

	function AssetManager.EnsureFolder(relative: string?)
		local current = ""
		for _, part in string.split(AssetManager.Path(relative), "/") do
			current = if current == "" then part else `{current}/{part}`
			if not isfolder(current) then
				makefolder(current)
			end
		end
	end

	function AssetManager.IsFile(relative: string): boolean
		local success, result = pcall(isfile, AssetManager.Path(relative))
		return success and result == true
	end

	function AssetManager.Read(relative: string): string?
		return if AssetManager.IsFile(relative) then readfile(AssetManager.Path(relative)) else nil
	end

	function AssetManager.Write(relative: string, data: string)
		writefile(AssetManager.Path(relative), data)
	end

	function AssetManager.Download(relative: string, url: string, validate: ((string) -> boolean)?)
		if AssetManager.IsFile(relative) then return end

		local data = game:HttpGet(url)
		assert(not validate or validate(data), `Invalid download for {relative}`)
		AssetManager.Write(relative, data)
	end

	function AssetManager.ListNames(): { string }
		local names = {}
		for _, entry in listfiles(BASE_PATH) do
			local name = entry:gsub("\\", "/"):gsub("/$", ""):match("([^/]+)$")
			if name then
				table.insert(names, name)
			end
		end
		return names
	end

	function AssetManager.GetAsset(relative: string): string
		return getcustomasset(AssetManager.Path(relative))
	end
end

--// Constants \\--
local ASSET_BASE_URL = "https://raw.githubusercontent.com/notpoiu/Molto/d20425dafc9af10042f3a9455e7f561b8d021746/"
local DEFAULT_PROVIDER = "lucide"
local PROVIDERS = {lucide={Hash="df89ed6afa208f5822f48e11a939c09ad848a803677200765052d6676804ec92",Font=true,Name="Lucide",FontPartSize=1500,Sheets=3,License="ISC",Count=1949,FontParts=2},tabler={Hash="953eab1a483d7d923d2d885572bc440dc71328a6d684a83f18989ea1f91e28fb",Font=true,Name="Tabler",FontPartSize=1500,Sheets=8,License="MIT",Count=6286,FontParts=5},heroicons={Hash="711ade2a9a57e4ac56b87a95821222319f0e38dc552f30522be69e5d95ca2653",Font=true,Name="Heroicons",FontPartSize=1500,Sheets=2,License="MIT",Count=1288,FontParts=1},fluent={Hash="147c6982e1add2de0edee16ee9b04eed24e29eab03bcaa6f4057606590981f14",Font=false,Name="Fluent UI",FontPartSize=1500,Sheets=26,License="MIT",Count=20289,FontParts=0},phosphor={Hash="25c6bb8954fd67bb31f1e3a205f1b23a431943a260006da71efb1095f286a519",Font=true,Name="Phosphor",FontPartSize=1500,Sheets=12,License="MIT",Count=9161,FontParts=7}}

local MAX_ALIAS_DEPTH = 8

--// Providers \\--
type ProviderState = {
	Id: string,
	Icons: { string },
	Aliases: { [string]: string },
	Rects: { { any } },
	Index: { [string]: number },
	SheetUrls: { [number]: string },
	Folder: string,
	FontPartSize: number?,
	FontName: string,
	Fonts: { [number]: Font | false },
}

local loadedProviders: { [string]: ProviderState } = {}
local currentProvider = DEFAULT_PROVIDER

-- Keeps only the newest build of a provider on disk
local function PruneCache(id: string, currentFolder: string)
	if not AssetManager.CanDelete then return end

	for _, name in AssetManager.ListNames() do
		local hash = if name:sub(1, #id + 1) == `{id}-` then name:sub(#id + 2) else nil
		if hash and name ~= currentFolder and hash:match("^" .. string.rep("%x", 64) .. "$") then
			pcall(delfolder, AssetManager.Path(name))
		end
	end
end

local function LoadProvider(id: string): ProviderState
	local loaded = loadedProviders[id]
	if loaded then return loaded end

	local meta = PROVIDERS[id]
	assert(meta, `Unknown icon provider "{id}"`)

	local folder = `{id}-{meta.Hash}`
	local dataFile = `{folder}/data.lua`
	local dataUrl = `{ASSET_BASE_URL}providers/{id}.lua`

	local useCustomSprites = false
	local source: string? = nil

	if AssetManager.Supported then
		useCustomSprites = pcall(function()
			AssetManager.EnsureFolder(folder)
			for sheet = 1, meta.Sheets do
				AssetManager.Download(`{folder}/{sheet}.png`, `{ASSET_BASE_URL}spritesheets/{id}/{sheet}.png`, function(data)
					return data:sub(1, 8) == "\137PNG\r\n\26\n" -- PNG header
				end)
			end
			AssetManager.GetAsset(`{folder}/1.png`)
		end)

		pcall(function()
			AssetManager.EnsureFolder(folder)
			AssetManager.Download(dataFile, dataUrl, function(data)
				return data:sub(1, 6) == "return"
			end)
			source = AssetManager.Read(dataFile)
		end)

		if useCustomSprites then
			pcall(PruneCache, id, folder)
		end
	end

	local data = loadstring(source or game:HttpGet(dataUrl))()

	local sheetUrls = {}
	for sheet, fallback in data.Sheets do
		sheetUrls[sheet] = if useCustomSprites then AssetManager.GetAsset(`{folder}/{sheet}.png`) else fallback
	end

	local index = {}
	for position, name in data.Icons do
		index[name] = position
	end

	local state: ProviderState = {
		Id = id,
		Icons = data.Icons,
		Aliases = data.Aliases,
		Rects = data.Rects,
		Index = index,
		SheetUrls = sheetUrls,
		Folder = folder,
		FontPartSize = if meta.Font then meta.FontPartSize else nil,
		FontName = meta.Name,
		Fonts = {},
	}

	loadedProviders[id] = state
	return state
end

-- Big sets are split into several fonts, so a font is downloaded when its first icon is looked up
local function GetFontFace(state: ProviderState, part: number): Font?
	local cached = state.Fonts[part]
	if cached ~= nil then return cached or nil end

	local face: Font? = nil
	if AssetManager.Supported then
		pcall(function()
			local ttfFile = `{state.Folder}/font-{part}.ttf`
			local familyFile = `{state.Folder}/font-{part}.json`

			AssetManager.EnsureFolder(state.Folder)
			AssetManager.Download(ttfFile, `{ASSET_BASE_URL}fonts/{state.Id}/{state.Id}-{part}.ttf`, function(data)
				return data:sub(1, 4) == "\0\1\0\0" -- TrueType header
			end)
			AssetManager.Write(familyFile, game:GetService("HttpService"):JSONEncode({
				name = `{state.FontName} {part}`,
				loadStrategy = "sameFamilyOnly",
				faces = {
					{ name = "Regular", weight = 400, style = "normal", assetId = AssetManager.GetAsset(ttfFile) },
				},
			}))

			face = Font.new(AssetManager.GetAsset(familyFile))
		end)
	end

	state.Fonts[part] = face or false
	return face
end

--// API \--
Registry.Providers = {}
for id in PROVIDERS do
	table.insert(Registry.Providers, id)
end
table.sort(Registry.Providers)

function Registry.GetProviderInfo(id: string?)
	local meta = PROVIDERS[id or currentProvider]
	if not meta then return nil end

	return { Id = id or currentProvider, Name = meta.Name, License = meta.License, Count = meta.Count }
end

function Registry.GetProvider(): string
	return currentProvider
end

function Registry.SetProvider(id: string)
	assert(PROVIDERS[id], `Unknown icon provider "{id}"`)

	LoadProvider(id)
	currentProvider = id
end

function Registry.GetIcons(provider: string?): { string }
	return LoadProvider(provider or currentProvider).Icons
end

function Registry.HasIcon(name: string, provider: string?): boolean
	return Registry.GetAsset(name, provider) ~= nil
end

function Registry.GetAsset(name: string, provider: string?)
	local state = LoadProvider(provider or currentProvider)

	local resolved = name
	for _ = 1, MAX_ALIAS_DEPTH do
		local target = state.Aliases[resolved]
		if not target then break end
		resolved = target
	end

	local position = state.Index[resolved]
	if not position then
		return nil
	end

	local rect = state.Rects[position]
	local fontFace = if state.FontPartSize then GetFontFace(state, math.ceil(position / state.FontPartSize)) else nil

	return {
		IconName = name,
		Provider = state.Id,
		Url = state.SheetUrls[rect[1]],
		ImageRectSize = Vector2.new(rect[2][1], rect[2][2]),
		ImageRectOffset = Vector2.new(rect[3][1], rect[3][2]),

		-- Only present when the provider font loaded. The font shapes Text into one icon through a ligature
		FontFace = fontFace,
		Text = if fontFace then resolved else nil,
	}
end

return Registry
