--// Lune stuff \\--
local DateTime = require("@lune/datetime")
local fs = require("@lune/fs")
local luau = require("@lune/luau")
local task = require("@lune/task")
local process = require("@lune/process")
local stdio = require("@lune/stdio")
local serde = require("@lune/serde")

--// Types \\--
type ProviderConfig = {
	id: string,
	prefix: string,
	name: string?,
	font: boolean?,
}

type ProviderMeta = {
	Name: string,
	License: string,
	Hash: string,
	Sheets: number,
	Count: number,
	Font: boolean,
	FontParts: number,
	FontSources: { string },
	SourceHash: string,
}

type UploadAssetOptions = {
	path: string,
	name: string,
	description: string?,
}

--// Constants \\--
local BUILD_VERSION = DateTime.now():toIsoDate()
local ROBLOX_API_TOKEN = process.env["ROBLOX_API_TOKEN"]
local ROBLOX_CREATOR_ID = process.env["ROBLOX_CREATOR_ID"]

local ICON_SIZE = 24
local WORKERS = 8
local FONT_WORKERS = 3
-- A TrueType ligature table overflows at a few thousand icons, so big sets are split into several fonts.
-- This is the target number of icons per font, the real count varies a little because icons are spread by name hash
local FONT_PART_SIZE = 1500
-- Bump when the build pipeline changes in a way that alters the generated assets
local PIPELINE_VERSION = 1
local ICON_SETS_DIR = "build/icon-sets"
local MANIFEST_PATH = "providers/manifest.json"

local LUA_KEYWORDS = {
	"and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in",
	"local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while", "continue",
}

--// Arguments \\--
-- usage: lune run scripts/build.luau [--dry-run] [--force] [provider ids...]
-- Providers whose icon set and build settings did not change are skipped unless --force is given
local DryRun = false
local Force = false
local RequestedProviders = {}
for _, arg in process.args do
	if arg == "--dry-run" then
		DryRun = true
	elseif arg == "--force" then
		Force = true
	else
		table.insert(RequestedProviders, arg)
	end
end

--// Serialization \\--
local LuaEncode = require("./utils/LuaEncode")

--// Utility functions \\--
local function ReplaceScriptGlobals(script: string, replacements: { [string]: string }): string
	for key, value in replacements do
		script = script:gsub(key, function()
			return value
		end)
	end
	return script
end

local function RunCommand(cmd: string, cwd: string?, check: boolean?): any
	local checkFlag = if check == nil then true else check

	local options = {}
	if cwd then
		options.cwd = cwd
	end

	local result = process.exec("sh", { "-c", cmd }, options)

	if checkFlag and not result.ok then
		stdio.ewrite(`Error running command: {cmd}\n`)
		stdio.ewrite(`Exit code: {result.code}\nOutput:{result.stdout}\n{result.stderr}`)
	end

	return result
end

-- Runs fn over items with a fixed number of concurrent workers
local function RunPool(items: { any }, fn: (any) -> string, workers: number?)
	local total = #items
	local nextIndex = 0
	local completed = 0

	for _ = 1, math.min(workers or WORKERS, total) do
		task.spawn(function()
			while true do
				nextIndex += 1
				local item = items[nextIndex]
				if item == nil then
					break
				end

				local message = fn(item)
				completed += 1
				print(`[{completed}/{total}] {message}`)
			end
		end)
	end

	while completed < total do
		task.wait(0.1)
	end
end

local function ListFiles(dir: string, extension: string): { string }
	local files = {}
	if fs.isDir(dir) then
		for _, file in fs.readDir(dir) do
			if file:match(`%.{extension}$`) then
				table.insert(files, `{dir}/{file}`)
			end
		end
	end
	table.sort(files)
	return files
end

local function ResetDir(path: string)
	if fs.isDir(path) then
		fs.removeDir(path)
	end
	fs.writeDir(path)
end

-- Uploaded sheets are remembered by content hash, so re-running a build never uploads the same image twice
local UPLOADS_PATH = "providers/uploads.json"
local Uploads = if fs.isFile(UPLOADS_PATH) then serde.decode("json", fs.readFile(UPLOADS_PATH)) else {}

local function UploadImageAssetToRoblox(options: UploadAssetOptions): string
	if DryRun then
		return "0"
	end

	local FileHash = serde.hash("sha256", fs.readFile(options.path))
	if Uploads[FileHash] then
		return Uploads[FileHash]
	end

	assert(ROBLOX_API_TOKEN, "ROBLOX_API_TOKEN environment variable is not set")
	assert(ROBLOX_CREATOR_ID, "ROBLOX_CREATOR_ID environment variable is not set")

	local Result = RunCommand(
		`python scripts/utils/Upload.py {options.path} --name "{options.name}" --description "{options.description or ""}" --auth "{ROBLOX_API_TOKEN}" --creator-id {ROBLOX_CREATOR_ID}`,
		nil,
		true
	)

	if not Result.ok then
		stdio.ewrite(`Failed to upload image asset: {Result.stderr}\n`)
		process.exit(1)
	end

	local CleanedOutput = Result.stdout:gsub("\n", ""):gsub("\r", "")
	CleanedOutput = CleanedOutput:gsub(" ", "")

	Uploads[FileHash] = CleanedOutput
	if not fs.isDir("providers") then
		fs.writeDir("providers")
	end
	fs.writeFile(UPLOADS_PATH, serde.encode("json", Uploads, true))

	return CleanedOutput
end

--// Iconify \\--
-- Docs: https://iconify.design/docs/types/iconify-json.html
function SetupIconSets()
	if not fs.isDir(ICON_SETS_DIR) then
		print("Cloning iconify/icon-sets...")
		RunCommand(`git clone --filter=blob:none --sparse https://github.com/iconify/icon-sets.git icon-sets`, "build")
	end

	RunCommand("git sparse-checkout set --no-cone /json/", ICON_SETS_DIR)
	RunCommand("git pull --ff-only", ICON_SETS_DIR)
end

local function ResolveIcon(set: any, name: string, seen: { [string]: boolean }): any?
	local icon = set.icons[name]
	if icon then
		return {
			body = icon.body,
			width = icon.width or set.width or 16,
			height = icon.height or set.height or 16,
			rotate = icon.rotate or 0,
			hFlip = icon.hFlip or false,
			vFlip = icon.vFlip or false,
		}
	end

	local alias = if set.aliases then set.aliases[name] else nil
	if not alias or seen[name] then
		return nil
	end
	seen[name] = true

	local parent = ResolveIcon(set, alias.parent, seen)
	if not parent then
		return nil
	end

	return {
		body = parent.body,
		width = alias.width or parent.width,
		height = alias.height or parent.height,
		rotate = (parent.rotate + (alias.rotate or 0)) % 4,
		hFlip = parent.hFlip ~= (alias.hFlip or false),
		vFlip = parent.vFlip ~= (alias.vFlip or false),
	}
end

local function BuildSvg(icon: any): string
	local width, height = icon.width, icon.height
	local side = math.max(width, height)
	local centerX, centerY = width / 2, height / 2

	-- Roblox renders one square image, so pad non-square icons instead of stretching them
	local viewBox = `{(width - side) / 2} {(height - side) / 2} {side} {side}`
	local body = icon.body:gsub("[cC][uU][rR][rR][eE][nN][tT][cC][oO][lL][oO][rR]", "#000000")

	if icon.hFlip or icon.vFlip then
		body = `<g transform="translate({centerX} {centerY}) scale({if icon.hFlip then -1 else 1} {if icon.vFlip then -1 else 1}) translate({-centerX} {-centerY})">{body}</g>`
	end

	if icon.rotate ~= 0 then
		body = `<g transform="rotate({icon.rotate * 90} {centerX} {centerY})">{body}</g>`
	end

	return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="{viewBox}" width="{side}" height="{side}">{body}</svg>`
end

-- Writes one svg per icon and returns the sorted icon names plus the alias map
local function GenerateSvgs(provider: ProviderConfig, svgDir: string): ({ string }, { [string]: string }, any)
	local setPath = `{ICON_SETS_DIR}/json/{provider.prefix}.json`
	assert(fs.isFile(setPath), `Icon set "{provider.prefix}" not found in iconify/icon-sets`)

	local set = serde.decode("json", fs.readFile(setPath))
	if set.info and set.info.palette then
		stdio.ewrite(`Warning: "{provider.prefix}" is a multi-color set, colors will be inverted\n`)
	end

	ResetDir(svgDir)

	local aliases = set.aliases or {}

	-- An alias with only a parent is the same picture, so it points at the real icon instead of costing sprite space
	local function Canonical(name: string): string
		local alias = aliases[name]
		if set.icons[name] or not alias then
			return name
		end

		for key in alias do
			if key ~= "parent" then
				return name
			end
		end

		return Canonical(alias.parent)
	end

	local names = {}
	local aliasMap = {}

	for name in set.icons do
		table.insert(names, name)
	end

	for name in aliases do
		local target = Canonical(name)
		if target == name then
			table.insert(names, name)
		else
			aliasMap[name] = target
		end
	end

	table.sort(names)

	local kept = {}
	for _, name in names do
		local icon = ResolveIcon(set, name, {})
		if icon then
			fs.writeFile(`{svgDir}/{name}.svg`, BuildSvg(icon))
			table.insert(kept, name)
		end
	end

	return kept, aliasMap, set.info
end

--// Conversion and Processing Functions \\--
local CHUNK_SIZE = 250

local function Chunk(items: { string }): { { string } }
	local chunks = {}
	for start = 1, #items, CHUNK_SIZE do
		table.insert(chunks, table.move(items, start, math.min(start + CHUNK_SIZE - 1, #items), 1, {}))
	end
	return chunks
end

-- Inkscape and ImageMagick take seconds to start, so every process handles a whole chunk of files
local function ConvertSvgsToPngs(svgDir: string, pngDir: string)
	local svgFiles = ListFiles(svgDir, "svg")
	print(`Converting {#svgFiles} SVG files to PNG...`)

	local chunks = Chunk(svgFiles)
	RunPool(chunks, function(chunk: { string })
		-- `inkscape --shell` runs one export per line from stdin
		local lines = {}
		for _, svgFile in chunk do
			local filename = svgFile:match("([^/]+)%.svg$")
			table.insert(
				lines,
				`file-open:{svgFile}; export-type:png; export-filename:{pngDir}/{filename}.png; export-width:{ICON_SIZE}; export-height:{ICON_SIZE}; export-background-opacity:0; export-do; file-close`
			)
		end

		local commandFile = `{pngDir}/../inkscape-{chunk[1]:match("([^/]+)%.svg$")}.txt`
		fs.writeFile(commandFile, table.concat(lines, "\n") .. "\nquit\n")
		RunCommand(`inkscape --shell < "{commandFile}"`, nil, false)
		fs.removeFile(commandFile)

		return `Converted {#chunk} icons from {chunk[1]:match("[^/]+$")}`
	end)
end

local function ProcessPngs(pngDir: string)
	local pngFiles = ListFiles(pngDir, "png")
	print(`Processing {#pngFiles} PNG files with ImageMagick...`)

	RunPool(Chunk(pngFiles), function(chunk: { string })
		local quoted = {}
		for _, file in chunk do
			table.insert(quoted, `"{file}"`)
		end

		local result = RunCommand(
			`magick mogrify -channel RGB -negate +channel -alpha on -type TrueColorAlpha -colorspace sRGB -define png:color-type=6 {table.concat(quoted, " ")}`,
			nil,
			false
		)

		if result.ok then
			return `Processed {#chunk} icons from {chunk[1]:match("[^/]+$")}`
		end
		return `Failed to process chunk from {chunk[1]:match("[^/]+$")}: Exit code {result.code}`
	end)
end

--// Incremental builds \\--
local Manifest: { [string]: any } = {}

-- Identifies everything that decides a provider's assets, so unchanged providers can be skipped
local function ComputeSourceHash(provider: ProviderConfig): string
	local setPath = `{ICON_SETS_DIR}/json/{provider.prefix}.json`
	assert(fs.isFile(setPath), `Icon set "{provider.prefix}" not found in iconify/icon-sets`)

	return serde.hash(
		"sha256",
		table.concat({
			serde.hash("sha256", fs.readFile(setPath)),
			tostring(PIPELINE_VERSION),
			tostring(ICON_SIZE),
			tostring(FONT_PART_SIZE),
			tostring(provider.font ~= false),
			provider.name or "",
		}, "\n")
	)
end

local function IsUpToDate(provider: ProviderConfig, hash: string): boolean
	local meta = Manifest[provider.id]
	if Force or not meta or meta.SourceHash ~= hash then
		return false
	end

	-- The generated files must still exist
	if not fs.isFile(`providers/{provider.id}.lua`) or not fs.isFile(`site/data/{provider.id}.json`) then
		return false
	end
	if not fs.isDir(`spritesheets/{provider.id}`) or #fs.readDir(`spritesheets/{provider.id}`) ~= meta.Sheets then
		return false
	end

	return (meta.Font == true) == fs.isDir(`fonts/{provider.id}`)
end

--// Fonts \\--
-- Must match FontPartOf in scripts/assets/template.luau. Spreading icons by name hash (instead of by position)
-- means adding or removing an icon only changes the font part that icon belongs to
local function FontPartOf(name: string, parts: number): number
	local hash = 7
	for index = 1, #name do
		hash = (hash * 131 + string.byte(name, index)) % 2147483629
	end
	return hash % parts + 1
end

--// Provider build \\--
local function BuildProvider(provider: ProviderConfig, SourceHash: string): ProviderMeta
	print(`\n=== Building provider "{provider.id}" ({provider.prefix}) ===`)

	local svgDir = `build/svg/{provider.id}`
	local outputDir = `build/outputs/{provider.id}`
	local pngDir = `{outputDir}/icons`

	local names, aliasMap, info = GenerateSvgs(provider, svgDir)
	assert(#names > 0, `No icons generated for {provider.id}`)

	ResetDir(outputDir)
	fs.writeDir(pngDir)

	ConvertSvgsToPngs(svgDir, pngDir)
	assert(#ListFiles(pngDir, "png") == #names, `SVG to PNG conversion failed for {provider.id}, check that inkscape runs`)
	ProcessPngs(pngDir)

	-- Create spritesheet
	print("Creating spritesheet...")
	for _, path in { ".tarmac-debug", "tarmac-manifest.toml" } do
		if fs.isDir(path) then
			fs.removeDir(path)
		elseif fs.isFile(path) then
			fs.removeFile(path)
		end
	end

	fs.writeFile(
		"tarmac.toml",
		table.concat({
			`name = "icon-registry-{provider.id}"`,
			"",
			"[[inputs]]",
			`glob = "{pngDir}/*.png"`,
			"packable = true",
			"",
			"codegen = true",
			`codegen-path = "{outputDir}/mappings.lua"`,
			`codegen-base-path = "{outputDir}"`,
			"",
		}, "\n")
	)

	if not RunCommand("tarmac sync --target debug").ok then
		print("Error occured while creating spritesheet via tarmac")
		process.exit(1)
	end

	-- Fetch icon mappings
	local Mappings
	do
		local Vector2Library = [[local Vector2 = {}

function Vector2.new(x: number, y: number)
    return { x, y }
end]]

		-- tarmac emits Lua keywords (e.g. "repeat") as bare keys
		local Corrected = fs.readFile(`{outputDir}/mappings.lua`)
		for _, keyword in LUA_KEYWORDS do
			Corrected = Corrected:gsub("(%s)" .. keyword .. " = {", `%1["{keyword}"] = \{`)
		end

		Mappings = luau.load(table.concat({ Vector2Library, Corrected }, "\n"))()["icons"]
	end

	-- Renumber sheets 1..N so loader file names stay stable
	local SheetFiles = fs.readDir(".tarmac-debug")
	table.sort(SheetFiles, function(a, b)
		return (tonumber(a) or 0) < (tonumber(b) or 0)
	end)

	local SheetIndexByTarmacId = {}
	local SheetDir = `spritesheets/{provider.id}`
	ResetDir(SheetDir)

	for index, file in SheetFiles do
		SheetIndexByTarmacId[file] = index
		fs.copy(`.tarmac-debug/{file}`, `{SheetDir}/{index}.png`)
	end

	-- Upload spritesheets (used when custom assets are unsupported by the executor)
	local ProviderName = provider.name or (info and info.name) or provider.id
	local Sheets = {}
	for index in SheetFiles do
		local assetId = UploadImageAssetToRoblox({
			path = `{SheetDir}/{index}.png`,
			name = `{ProviderName} Spritesheet {index}`,
			description = `Spritesheet for all {ProviderName} icons. Built at {BUILD_VERSION}.`,
		})

		print(`Uploaded {provider.id} spritesheet {index} with Content ID:`, assetId)
		Sheets[index] = `rbxassetid://{assetId}`
	end

	-- Generate icon data
	local Rects = {}
	local Icons = {}
	for _, name in names do
		local data = Mappings[name]
		if not data then
			stdio.ewrite(`Warning: {provider.id}/{name} missing from spritesheet\n`)
			continue
		end

		table.insert(Icons, name)
		table.insert(Rects, {
			SheetIndexByTarmacId[tostring(data.Image:gsub("rbxassetid://", ""))],
			data.ImageRectSize,
			data.ImageRectOffset,
		})
	end

	local Aliases = {}
	for alias, target in aliasMap do
		if Mappings[target] then
			Aliases[alias] = target
		end
	end

	fs.writeFile(
		`providers/{provider.id}.lua`,
		"return " .. LuaEncode({ Icons = Icons, Aliases = Aliases, Rects = Rects, Sheets = Sheets })
	)

	-- Index for the icon browser in site/
	fs.writeFile(`site/data/{provider.id}.json`, serde.encode("json", { icons = Icons, aliases = Aliases }))

	-- Icon font: names shape into one glyph through an OpenType ligature. Big sets are split into parts
	local FontDir = `fonts/{provider.id}`
	local Previous = Manifest[provider.id]
	local FontVersions = {}
	local FontSources = {}
	local FontParts = 0
	if provider.font ~= false then
		local PartCount = math.ceil(#Icons / FONT_PART_SIZE)
		local PartNames = {}
		for part = 1, PartCount do
			PartNames[part] = {}
		end
		for _, name in Icons do
			table.insert(PartNames[FontPartOf(name, PartCount)], name)
		end

		-- A part is rebuilt only when its icons or their svgs changed
		for part, names in PartNames do
			local lines = { tostring(PIPELINE_VERSION) }
			for _, name in names do
				table.insert(lines, `{name}:{serde.hash("sha256", fs.readFile(`{svgDir}/{name}.svg`))}`)
			end
			FontSources[part] = serde.hash("sha256", table.concat(lines, "\n"))
		end

		local Parts = {}
		for part = 1, PartCount do
			table.insert(Parts, part)
		end

		local Failed = false
		RunPool(Parts, function(part: number)
			local fontName = `{provider.id}-{part}`
			local codepointsFile = `{FontDir}/{fontName}.codepoints.json`

			local Unchanged = Previous
				and Previous.FontSources
				and Previous.FontSources[part] == FontSources[part]
				and fs.isFile(`{FontDir}/{fontName}.ttf`)
				and fs.isFile(codepointsFile)
			if Unchanged then
				FontVersions[part] = serde.decode("json", fs.readFile(codepointsFile)).version
				return `Font part {part} of {PartCount} unchanged`
			end

			local namesFile = `{outputDir}/font-part-{part}.json`
			fs.writeFile(namesFile, serde.encode("json", PartNames[part]))

			local FontResult = RunCommand(`node scripts/build-font.mjs {svgDir} {FontDir} {fontName} {namesFile}`, nil, false)
			if not FontResult.ok then
				Failed = true
				stdio.ewrite(`Font part {part} failed for {provider.id}\n{FontResult.stderr}\n`)
				return `✗ Font part {part}`
			end

			FontVersions[part] = serde.decode("json", fs.readFile(codepointsFile)).version
			return `✓ Font part {part} of {PartCount}`
		end, FONT_WORKERS)

		if Failed then
			stdio.ewrite(`Warning: font build failed for {provider.id}, it will ship without a font\n`)
			FontVersions = {}
			FontSources = {}
		else
			FontParts = PartCount

			-- Drop files from an older layout
			local Keep = {}
			for part = 1, PartCount do
				Keep[`{provider.id}-{part}.ttf`] = true
				Keep[`{provider.id}-{part}.codepoints.json`] = true
			end
			for _, file in fs.readDir(FontDir) do
				if not Keep[file] then
					if fs.isDir(`{FontDir}/{file}`) then
						fs.removeDir(`{FontDir}/{file}`)
					else
						fs.removeFile(`{FontDir}/{file}`)
					end
				end
			end
		end
	end

	if FontParts == 0 and fs.isDir(FontDir) then
		fs.removeDir(FontDir)
	end

	-- Hash every sheet and the font so the loader caches each build in its own folder
	local SheetHashes = { if FontParts > 0 then table.concat(FontVersions, ",") else "nofont" }
	for index in SheetFiles do
		table.insert(SheetHashes, serde.hash("sha256", fs.readFile(`{SheetDir}/{index}.png`)))
	end

	return {
		Name = ProviderName,
		License = (info and info.license and info.license.title) or "Unknown",
		Hash = serde.hash("sha256", table.concat(SheetHashes, "\n")),
		Sheets = #SheetFiles,
		Count = #Icons,
		Font = FontParts > 0,
		FontParts = FontParts,
		FontSources = FontSources,
		SourceHash = SourceHash,
	}
end

--// Main \\--
print("Starting Icon Registry build...")

local Config = serde.decode("json", fs.readFile("providers.json"))
Manifest = if fs.isFile(MANIFEST_PATH) then serde.decode("json", fs.readFile(MANIFEST_PATH)) else {}

local ToBuild: { ProviderConfig } = {}
for _, provider in Config.providers do
	if #RequestedProviders == 0 or table.find(RequestedProviders, provider.id) then
		table.insert(ToBuild, provider)
	end
end
assert(#ToBuild > 0, "No matching providers to build")

if not fs.isDir("build") then
	fs.writeDir("build")
end
if not fs.isDir("providers") then
	fs.writeDir("providers")
end
if not fs.isDir("site/data") then
	fs.writeDir("site/data")
end

SetupIconSets()

for _, provider in ToBuild do
	local hash = ComputeSourceHash(provider)
	if IsUpToDate(provider, hash) then
		print(`\n=== Skipping provider "{provider.id}", icon set unchanged ===`)
	else
		Manifest[provider.id] = BuildProvider(provider, hash)
	end
end

-- Drop providers removed from providers.json
local Known = {}
for _, provider in Config.providers do
	Known[provider.id] = true
end
for id in Manifest do
	if not Known[id] then
		Manifest[id] = nil
	end
end

assert(Manifest[Config.default], `Default provider "{Config.default}" has not been built`)
fs.writeFile(MANIFEST_PATH, serde.encode("json", Manifest, true))

-- Provider list for the icon browser in site/
local SiteProviders = {}
for _, provider in Config.providers do
	local meta = Manifest[provider.id]
	if meta then
		table.insert(SiteProviders, {
			id = provider.id,
			prefix = provider.prefix,
			label = meta.Name,
			license = meta.License,
			count = meta.Count,
			font = meta.Font,
		})
	end
end
fs.writeFile("site/data/providers.json", serde.encode("json", { default = Config.default, providers = SiteProviders }))

-- Updating source.lua
local Template = fs.readFile("scripts/assets/template.luau")

fs.writeFile(
	"source.lua",
	ReplaceScriptGlobals(Template, {
		["DATA_PROVIDERS"] = LuaEncode(Manifest),
		["DATA_DEFAULT_PROVIDER"] = `"{Config.default}"`,
	})
)

print("Icon Registry build completed successfully!")
