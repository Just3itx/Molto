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
local ASSET_BASE_URL = "https://molto.pages.dev/"
local DEFAULT_PROVIDER = "lucide"
local PROVIDERS = {lucide={Hash="d696c1613123ecf29dd415cafa9c1c4cfe753307ed88439c7c02e2bf765c75d4",FontSources={"4ebe99c5ae25efcc41662dc5ab6eaba4e593bb8a5553b88beb21214834291fdd","cf5cfeeb5d34dc869e14028d7b3b29890a3210a2e180c3b68bc35f1c68ab2447"},Font=true,Count=1962,SourceHash="423a40bf7c8261df0f4488795f29363459e0d983f7a472a56361a0ca732cb06b",Sheets=2,License="ISC",Name="Lucide",FontParts=2},tabler={Hash="e5e6ef7cc035c9828b5cddf5280412d3081277c7e2550b9ae09e7afad487c846",FontSources={"cc7965bfb2aaf7f3d7f8d0588d5eddefebbbed8b30a59b4b077d5b9f8adf891f","5cee0c3b5b0b34409d30f4a3f9b2f62e22b608c9b6794dff1974c0bc22c69201","91b40bd91bfeca8e50e0cbe4564dc54fc37d18ff81cb9827119bf41f212aa649","ded3bb4c65fe91d7538025ee7a66f156fbf87daadb118f9fadbfdac0663a51ce","e1531143a79337f8b92379276bbbc7dc79a44b69cc5684701432d186e75758c5"},Font=true,Count=6286,SourceHash="c4ac52a2a33e7c753fd0d132626ea18e96e99fd62beaebf9249932767e4f31eb",Sheets=4,License="MIT",Name="Tabler",FontParts=5},heroicons={Hash="da3ef30e5bda1a0cf6586a6de9789a12537d550aec9598eccc85b4326be76615",FontSources={"da02a3a8e3f2b01840e735d0025f9c898a597fa3f22802b8cf61fba7ca4dd065","1a0ce866418752177d2393a48aede97f27ba5c52239eab5e3b7a9b0de15e6c44"},Font=true,Count=1288,SourceHash="6439652a852d969b2916cffd09efb0ab9a6f2127b7b7692b7b0e48315b4b8029",Sheets=1,License="MIT",Name="Heroicons",FontParts=2},solar={Hash="01d27f4a6f5ef2740f7080fb66f89fdaca0682cff34776dd71342aed31c4788b",FontSources={"0fbc79d272ced0ecc7e9b4357c8d89c5fc58681d491c9af67cb7c16aa98db15d","c60573fba17a7a8493d8385cd2f63f5c6c2509b780a93ae358d42fdc4d724c42","9b645fa22ab9a6f9ff56f7bba9fcde3d6a9b85d09ccbd71a95e31914c636a51d","95f3976e92db9a2478efcc5629b8aec2693e33b17276ce8aa068055a1f33a08b","e12f62e3ef20c62d3a7735e915199dbc3baffbdb958c09ab24bfb1d04177ec2d","414dd9aa75fbfc2005138857544df5febe4a55e5b670d2303f2034f27e701426"},Font=true,Name="Solar",SourceHash="bc5184a9d553589aad59d3375558bd13e4af5bb176dea7c89a164eabf9ee28c7",Sheets=6,License="CC BY 4.0",Count=8859,FontParts=6},material={Hash="6d11d395dda424ae2d8253513ff7317b8fc0f4a0ada0456d607e59f13ab762ea",FontSources={"a6c3b947bc82401b8fb6c7fb8b37cae4efbdbaa7e3b0ea5ee2654ae9f318e3e4","7a7ca51f6604403d8a6f7e20d2625b80aeb9ffecb398775762a24e22c0f470b0","a1ef7a9bf6412ef4532c9eb14284b3046051fcb1b6a65015f1a61d6b692c0f53","e8d6e6babc6a12e7a0d703e5df813b1f3a965359af60e3a8b3673b3289b08f77","acb95b43b3d2b2a0276449de286742820855cacd790c55d81f878e961e35ec81","cfc9890dcf418bcbdcdb7ee3ffc194d21f8a82a648bbec0e19bbffde1740e075","8678c8a58f00204f31e5b39aada3a5bc3aa7c70680c2752c7b328fac72e28d56","dcddc643c20abafef86ff881df4431426570bec2b4d1ec07e9e6df482651104a","29ee2e12f047d3241c81cbf805678ef3e81ab0da562ea43a8d9c57ed9488375b","34c129915b924951d6a63961ee2a0a4df1fa4973b8dbb0f1b514b29db19b8410","736463c4cb2de1dfdb87191833fc9b0bb607c3afcfa8183e886d44a3bf91e445","00d98ed7e153a244c0099221af02796c48ecef42daaa02e5fc602ee1ab439826","74a8f8daf6a161836d72107ee02e942474817440794f3187832dd1450a006862","91d06a7f5b083e2fa865bff7c4742ba1f6f27c415a3462482b783916e0ab911a","4e942f188ad52e90818fc3bf37a28ef188621f546d975d1e537207326a9f7a3b","198f0878e3a7d4a0f6e16c1a754a6db440aeb6d3302d8a6131d5ca80cc81e2a8","2b8e4080a3cff6c658c825c0f283bca3ae51192f6370381ccee8d0c33ece58e3"},Font=true,Name="Material Symbols",SourceHash="83cdd5e4fbc8e9a6bf8b78864b81f967985bf2d6ff0fae751ea474af0193d84a",Sheets=11,License="Apache 2.0",Count=16442,FontParts=17},fluent={Hash="eea2ac0ea41cbaeaa955ffc63a8c19228eb254d1436c9537570627f000780f98",FontSources={"0ca2ebc12344dfc21b2a0c6d2cd967adff5437de09c2843f165fc0ea715b735e","c025ee859ab9b30623da15c41bdc54453d7ca28b3b7512ccbfee87da8a5e231c","81ec0aec30f4d22a749352e93543167320ed88a6f5c51aee63f31fc6ef42b4a2","08c2d11f4e3c3cf9c89a4c70dd3e1774a8590d9530836a03880025ddca5a3867","ec03717283f571d664222c4ac9ddd8cdc7378113e32b3ea9c3455e75fc59aada","5877c0d62d3b88e05847d6caa50b8ea228d27f66df3e15dfd7e4ada1b3f86a7e","6882f8421b1870a7ad7bd98ba933c950c9021d5975a291b6c5ded9a1c1eb3aae","0b6d115f0496bb0737ebd3092b0d6a77b0e1c8309824f36b44aaedfabad84d14","3b0484af44ee884f75040e964703fb659e14fead7be5eca80e9baed6eee5b09a","459b54e519f643aac8b4febc20ebce816f51299ea8b59ed881efdda46f97b8cf","b5b95e254ef47aacce39eccd3886587d050f1a9c103513516a775bc6112e4f93","12c77501f8279630483ec7fda5cbaedf23147b42ac89e70563f8b8dcf54f6900","2b33de99ad42aeaaa60414fd699fa6117683524760bb14b86d982c7bf0fa0f77","a0815cc57d498fb4dad8ad04a5164f1767c18aa96cdf864f31a6fba6ec29f0ab","b9708402b5a529863a263341478fd44ae6f362f2320bacf5118cda474bac1fcb","68b9dbded5d541c81943a74d381ae69516d02aa7f07ed0c3ab519f0c59a099f2","4685a4902150718823b10d7b0c442628dc79b78a648b6800e4dc581704cc7b67","03a38183356a4c6c15071c7ae71779146aa4fc6d6e47f3af6ae9ddd0582d3ad9","d4cf604e15f3c7e1e8bd65ef36f3342403eeea8f7773d79eceb116188507dc39","a80c414eb482bbad39463586ecb021f49fe1285072e5336a360786c6b3ea3e57","0b537ae8676593b0b991b9df6c76c69fe76a8e116a0193e335ae8346b67562f2","c4977f667b3efa70906ea3bc4e183a95a5e248f9e030fac10b07f608d45047b2","40a771f73627c5fd8093fc2d8b79819cf2aafa0fa48fa313460272dbdf5fcf55","c7f4bc777ac1aa70c54070b3b62e7d665b89a9e421346a285fca34be0704bbd7","5638ab3b76ca1af8584e592c5eb977b6ae331801f0078de546f8167999ef3231"},Font=true,Count=20289,SourceHash="7bf2c2d522bf7bf203a61b82b402f36b4ec6fbde41876b299d98b116c982125b",Sheets=13,License="MIT",Name="Fluent UI",FontParts=25},phosphor={Hash="3a5e9b8ed33e68efb30de3f96814cb55320b7d7579fa375e29cf2f9fcea4d371",FontSources={"e8c24227843917e3fc9290d8bf203705de7f4a59485d07f9401cea9d4fc3d1c9","616bc7cf12efd96cffe2ea91298d2a928e6e0a508a233ec887c97cbc9c4395bb","53f51b226944327ba01306717fe829cec5d638f4d1179b4f121af355330399d7","a4d996e7818c0514d1d1f5f068b33de5667c7c735b88414276686b29128cc829","a2c1f74720b1a04cb699b54cb3938fc81643bb7d036147753ea130ea70019bb4","32b4ec07d36dee3d04585246dbb3c82f3c178a1229cc6179827ca15fe3922776","e5c39571e65797199d631dd71df13f9ac935c784eb7f3c2abd8f3d0f58c2ff75"},Font=true,Count=9161,SourceHash="841b552595d27509a630dadd2bc5a04fc0b30e724e3b42f6f2807ef7628fd415",Sheets=6,License="MIT",Name="Phosphor",FontParts=7}}

local MAX_ALIAS_DEPTH = 8
local PRELOAD_WORKERS = 6

--// Providers \\--
type ProviderState = {
	Id: string,
	Icons: { string },
	Aliases: { [string]: string },
	Rects: { { any } },
	NoFont: { [string]: boolean },
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

	-- Icons with see-through layers cannot be drawn by a one color font, so they only exist as sprites
	local noFont = {}
	for _, name in data.NoFont or {} do
		noFont[name] = true
	end

	local state: ProviderState = {
		Id = id,
		Icons = data.Icons,
		Aliases = data.Aliases,
		Rects = data.Rects,
		NoFont = noFont,
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

-- Roblox does not shape a ligature whose text starts with a digit, so the font stores those icons with a letter prefix.
-- Must match LigatureOf in scripts/build.luau
local function LigatureOf(name: string): string
	return if name:match("^%d") then `x-{name}` else name
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

local function Resolve(state: ProviderState, name: string): string
	local resolved = name
	for _ = 1, MAX_ALIAS_DEPTH do
		local target = state.Aliases[resolved]
		if not target then break end
		resolved = target
	end
	return resolved
end

-- Downloads everything up front so GetAsset never yields. Without names it fetches every font part of the provider.
-- Returns the number of font parts that are ready
function Registry.PreloadAsync(names: { string }?, provider: string?): number
	local state = LoadProvider(provider or currentProvider)
	if not state.FontParts then return 0 end

	local seen: { [number]: boolean } = {}
	local queue: { number } = {}
	local function Add(part: number)
		if not seen[part] then
			seen[part] = true
			table.insert(queue, part)
		end
	end

	if names then
		for _, name in names do
			local resolved = Resolve(state, name)
			if state.Index[resolved] and not state.NoFont[resolved] then
				Add(FontPartOf(resolved, state.FontParts))
			end
		end
	else
		for part = 1, state.FontParts do
			Add(part)
		end
	end

	local ready = 0
	local function Work()
		while true do
			local part = table.remove(queue)
			if not part then return end
			if GetFontFace(state, part) then
				ready += 1
			end
		end
	end

	-- Several parts download at once, the rest of the queue is picked up as workers finish
	local workers = math.min(PRELOAD_WORKERS, #queue)
	if typeof(task) ~= "table" or workers <= 1 then
		Work()
		return ready
	end

	local running = workers
	for _ = 1, workers do
		task.spawn(function()
			pcall(Work)
			running -= 1
		end)
	end
	while running > 0 do
		task.wait()
	end
	return ready
end

function Registry.GetAsset(name: string, provider: string?)
	local state = LoadProvider(provider or currentProvider)

	local resolved = Resolve(state, name)

	local position = state.Index[resolved]
	if not position then
		return nil
	end

	local rect = state.Rects[position]
	local fontPart = if state.FontParts and not state.NoFont[resolved] then FontPartOf(resolved, state.FontParts) else nil
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
		Text = if fontFace then LigatureOf(resolved) else nil,
	}
end

function Registry.SetIcon(iconInstance: TextLabel | ImageLabel, name: string, provider: string?)
	assert(typeof(iconInstance) == "Instance" and (iconInstance:IsA("TextLabel") or iconInstance:IsA("ImageLabel")), "iconInstance must be a TextLabel or ImageLabel")
	
	local asset = Registry.GetAsset(name, provider)
	assert(asset, `Icon "{name}" not found in provider "{provider}"`)

	if iconInstance:IsA("TextLabel") then
		assert(asset.FontFace, "Environment does not support font icons. Try using an ImageLabel instead.")

		iconInstance.Text = asset.Text
		iconInstance.FontFace = asset.FontFace
	else
		iconInstance.Image = asset.Url
		iconInstance.ImageRectSize = asset.ImageRectSize
		iconInstance.ImageRectOffset = asset.ImageRectOffset
	end
end

return Registry
