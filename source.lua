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
local ASSET_BASE_URL = "https://raw.githubusercontent.com/notpoiu/Molto/6f4ef854d2ab1cf3c84b6c47b1cb780dea673035/"
local DEFAULT_PROVIDER = "lucide"
local PROVIDERS = {lucide={Hash="72719d6a69767d247b27a435120a24fa2b93e347e3ad875d7b2b2426be6acb47",FontSources={"33fcfc512826c95ed4f76a621599ad20b7f66a9c8495701bedb8d5a2129e219a","b47e65ecec6ba0b6fc459cdbbf5117d8878e67bb523ff7e0385bf6b52050808f"},Font=true,Name="Lucide",SourceHash="04c7488839c15d52cefb95f13250c7a20d2332d9a49801ff5a350ab90cb5dade",Sheets=2,License="ISC",Count=1949,FontParts=2},tabler={Hash="639fa7f8e848b9b6c860cce1bb87c53ffaa4dba91e2c521afb6696b5630bb345",FontSources={"0f3115c2d63ce585cade147a824513a3d4c30eb6159be6a3d91dcf39ec315d6d","f4c42962feda03d29a495d202b8969b7382c76e8cb6c71faf18c2f441ec145c5","3c30b386ea3c72453d4d276ff48684d5b2dfb0208e8b1e7cf990f99f156c0e8f","42cf93226fd11472af0c56a7122ad731a8c48c726224651176e9e9cd95a9a838","47724ce905252465d65f79d30dc18ea55daad1d570a0b7289f91f858189e3d75"},Font=true,Name="Tabler",SourceHash="7ad832b08e356abf727971487f46084d664637c8fa6cd8432516d9895f55d770",Sheets=4,License="MIT",Count=6286,FontParts=5},heroicons={Hash="aca1c001aed61e3ea4835e0875b5237d65139ff3bee0d78439d69c7359848499",FontSources={"de1c58d10ae52c17568bc95e0c199fd33fd43568a4aa0463cb7a61c60876a7e0","47ae81c4100a7bb7551a1cba06ca10894cdd3e38ef7f023c437f17e1919def82"},Font=true,Name="Heroicons",SourceHash="84e2bb9f32bfa322f27b94779f4d0930e2d2ee3636dd9607d84c0c701edf1521",Sheets=1,License="MIT",Count=1288,FontParts=2},fluent={Hash="08b5190ce61c727c2283af2f93fe2eb71f76dea380b010557b2b69e169d7f517",FontSources={"f057fb41fc603cbb3aed59f761682e866f667e061ad219cbcabe167ec4179d85","ad6a0ed6de6baca559d5aff11afe4680fb3cb641acf896e16604676ed2414054","bcfb9c16d70f00875dbb0ebaf272a92d132f13242ea005560aacfb1cec73811e","98226cfb45469412340e378ae5d0cc01ccae114a0f9c0b2fce2e1a3727eefef8","5910b2bac0e7378bc209960c4e8c3df4b51859d5b497fbb91409054278f82bb4","cc14755bd77a2dcf8e26d01bfdab264e451d360f6fda68642031e740bb9fbcef","ae454c567f5446d2c3311f887663ce3e438381262bc5be5a6cf034e476b37cde","3b60fc0d1169a88b230c202b4084f05b652729d655184e4e15969a0912bb3240","e8cab52a756e6021c936a0fcbf37737c647035d950876b26f080fc0ce7cc6235","481f709369043cfcd6cebe1f9778f68fbf2674ebb122bf3d1cf91061289832d6","4789aeeafdfbcbdea814d500564d9ef89e9d1646c2bc6e865ec206da77fa00e4","38d265e4a8370e6a8ec5ceff2a49810c6f6d9583c81f27ec875f61bf7f77224e","70c87fcc51e80698dbdcf8244d19a3cbff7a6a8c59c350b6c3db03f270d9285c","84bfd4a6c9eef3e12e02615e58d9543909ea8fa1a6164b74351337048d834495","53b51a7840398bb5d39d30232f04a2171a520ca770521fc807bfa023298ea2fa","ed0a815dbe5b738eaa3fcc1e0f689c42f06d89089d440743d582bcaf6dea65db","a71b841816668db383cd458f3d30ca5fc08dfcedfdb3f896828c26931da63d1a","0872ad57cda3d6bc60444990360274271c8baafb44339b446aa235bdb265c22d","96c95690331e6d66fdf17984209fc38685abcd42f2c2c5e739b814b22bf719d5","7cd856e4155c4f404c57d57ba455a64da1da560a8f9584a69cbafd61843d499c","6192d77f7575522a790c40c08d4c331720978673196547a2675f13cadaa4b010","61b88f9ca9ac49d74dcc5b71788b89cfe23e11cfeec4aacd86df65d1fd174fb8","477c44219f6eefe7db3271231132533721dabffdfd0b5363bf1dce52bb36cfad","09afea2f083cc0fa1e32444db19f958540e22e028552f2113fe1c788db8ec781","5d9bafeaf5e239e0154e93e13a74700b4bc63090d2ba15653b47d34fdcff6203"},Font=true,Name="Fluent UI",SourceHash="04d28fb19163cc17c548151dc5e64305294ba86d6c8045d8654ef72d22c50867",Sheets=13,License="MIT",Count=20289,FontParts=25},phosphor={Hash="68d4d3dd299e09862c550b79cd790eaacb9a71b622d997b24c1a6110a59324d3",FontSources={"7d852084dbed1cededa2a619a735824053562401f7d12c9dfe95a243ae534879","f5fe50ceb3b4eaf813951c44adb4d4953088fb4f7d98903b5ab486a1a854169e","32c3b77a0f802867af6fb04ddf136bca7778930a8eef552557ebc1cd899afb53","f85254c670b8daaf501515c3c3aeec8583e7fccf682309cf6310ac917a976c39","e3660683aec8bc2e67c29f3da4a6fc7875f1259f97a65467649547b9aa08b4b2","060973db9c67c7b31b9119d241db6ad249ddfac5a9f2adc1ef849377f42840cf","b9882df096aee67fdf5ce4196f5e7b629934e073b535f7778d91764d0868fe43","2e06138eed09518a6b4190a9b30b5fe6018927f24ef9c749fd84871847636b5c"},Font=true,Name="Phosphor",SourceHash="a8df66a0ec35bf0cb6a93b7d3496522786e3dd0c4351549aeedee39450a5a3fd",Sheets=6,License="MIT",Count=9161,FontParts=8}}

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
	FontParts: number?,
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
		FontParts = if meta.Font then meta.FontParts else nil,
		FontName = meta.Name,
		Fonts = {},
	}

	loadedProviders[id] = state
	return state
end

-- Must match FontPartOf in scripts/build.luau
local function FontPartOf(name: string, parts: number): number
	local hash = 7
	for index = 1, #name do
		hash = (hash * 131 + string.byte(name, index)) % 2147483629
	end
	return hash % parts + 1
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
	local fontPart = if state.FontParts then FontPartOf(resolved, state.FontParts) else nil
	local fontFace = if fontPart then GetFontFace(state, fontPart) else nil

	return {
		IconName = name,
		Provider = state.Id,
		Url = state.SheetUrls[rect[1]],
		ImageRectSize = Vector2.new(rect[2][1], rect[2][2]),
		ImageRectOffset = Vector2.new(rect[3][1], rect[3][2]),

		-- Only present when the provider font loaded. The font shapes Text into one icon through a ligature
		FontFace = fontFace,
		FontPart = fontPart,
		Text = if fontFace then resolved else nil,
	}
end

return Registry
