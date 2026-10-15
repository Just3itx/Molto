--[[
	Molto icon explorer

	An in-game browser for every icon of every provider. Pick a provider, search, click an icon to see it
	at a larger size, then copy its name or ready-to-run Luau for it.

	Paste the file into your executor and run it. It loads Molto from the site by itself.
]]

local UserInputService = game:GetService("UserInputService")

--// Settings \\--
local LOADER_URL = "https://molto.pages.dev/source.lua"
local CHUNK = 150 -- tiles created per batch while scrolling
local TILE = 56
local PREVIEW_SIZE = 64

local Icons = loadstring(game:HttpGet(LOADER_URL))()

local Theme = {
	Background = Color3.fromRGB(13, 12, 11),
	Surface = Color3.fromRGB(23, 21, 19),
	Surface2 = Color3.fromRGB(33, 30, 27),
	Border = Color3.fromRGB(46, 42, 38),
	Text = Color3.fromRGB(243, 237, 228),
	Muted = Color3.fromRGB(154, 145, 136),
	Accent = Color3.fromRGB(255, 138, 61),
	AccentText = Color3.fromRGB(26, 15, 6),
}

--// Helpers \\--
local function New(class: string, properties: { [string]: any }, children: { Instance }?): any
	local instance = Instance.new(class)
	for key, value in properties do
		if key ~= "Parent" then
			instance[key] = value
		end
	end
	for _, child in children or {} do
		child.Parent = instance
	end
	instance.Parent = properties.Parent
	return instance
end

local function Corner(radius: number): UICorner
	return New("UICorner", { CornerRadius = UDim.new(0, radius) })
end

local function Padding(all: number): UIPadding
	local pad = UDim.new(0, all)
	return New("UIPadding", { PaddingTop = pad, PaddingBottom = pad, PaddingLeft = pad, PaddingRight = pad })
end

local function Copy(text: string): boolean
	local copy = setclipboard or toclipboard or (Clipboard and Clipboard.set)
	if typeof(copy) ~= "function" then
		return false
	end
	return pcall(copy, text)
end

-- Fills an existing TextLabel or ImageLabel with an icon. Returns false when the icon could not be drawn
local function Draw(label: TextLabel | ImageLabel, name: string): boolean
	return (pcall(Icons.SetIcon, label, name))
end

--// State \\--
local state = {
	Provider = Icons.GetProvider(),
	Query = "",
	Results = {} :: { string },
	Shown = 0,
	Selected = nil :: string?,
	UseFont = true,
	Token = 0, -- bumped on every provider change so a slow load cannot overwrite a newer one
}

--// Interface \\--
local parent = (typeof(gethui) == "function" and gethui()) or game:GetService("CoreGui")
local gui = New("ScreenGui", {
	Name = "MoltoIconExplorer",
	ResetOnSpawn = false,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	DisplayOrder = 999,
	Parent = parent,
})

local window = New("Frame", {
	Name = "Window",
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.5),
	Size = UDim2.fromOffset(780, 500),
	BackgroundColor3 = Theme.Background,
	BorderSizePixel = 0,
	Parent = gui,
}, { Corner(12), New("UIStroke", { Color = Theme.Border, Thickness = 1 }) })

-- Title bar (drag handle)
local titleBar = New("Frame", {
	Size = UDim2.new(1, 0, 0, 42),
	BackgroundTransparency = 1,
	Parent = window,
})

New("TextLabel", {
	Position = UDim2.fromOffset(16, 0),
	Size = UDim2.new(1, -64, 1, 0),
	BackgroundTransparency = 1,
	Text = "Molto Icons",
	TextColor3 = Theme.Accent,
	TextSize = 18,
	FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold),
	TextXAlignment = Enum.TextXAlignment.Left,
	Parent = titleBar,
})

local closeButton = New("TextButton", {
	AnchorPoint = Vector2.new(1, 0.5),
	Position = UDim2.new(1, -10, 0.5, 0),
	Size = UDim2.fromOffset(28, 28),
	BackgroundColor3 = Theme.Surface,
	Text = "X",
	TextColor3 = Theme.Muted,
	TextSize = 14,
	FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold),
	AutoButtonColor = false,
	Parent = titleBar,
}, { Corner(8) })

-- Sidebar with the providers
local sidebar = New("Frame", {
	Position = UDim2.fromOffset(10, 48),
	Size = UDim2.new(0, 168, 1, -58),
	BackgroundColor3 = Theme.Surface,
	BorderSizePixel = 0,
	Parent = window,
}, { Corner(10), Padding(8) })

New("TextLabel", {
	Size = UDim2.new(1, 0, 0, 22),
	BackgroundTransparency = 1,
	Text = "Providers",
	TextColor3 = Theme.Text,
	TextSize = 15,
	FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold),
	TextXAlignment = Enum.TextXAlignment.Left,
	Parent = sidebar,
})

local providerList = New("ScrollingFrame", {
	Position = UDim2.fromOffset(0, 28),
	Size = UDim2.new(1, 0, 1, -28),
	BackgroundTransparency = 1,
	BorderSizePixel = 0,
	ScrollBarThickness = 3,
	AutomaticCanvasSize = Enum.AutomaticSize.Y,
	CanvasSize = UDim2.new(),
	Parent = sidebar,
}, { New("UIListLayout", { Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }) })

-- Search and status
local content = New("Frame", {
	Position = UDim2.fromOffset(186, 48),
	Size = UDim2.new(1, -196, 1, -58),
	BackgroundTransparency = 1,
	Parent = window,
})

local searchBox = New("TextBox", {
	Size = UDim2.new(1, -150, 0, 36),
	BackgroundColor3 = Theme.Surface,
	PlaceholderText = "Search icons...",
	PlaceholderColor3 = Theme.Muted,
	Text = "",
	TextColor3 = Theme.Text,
	TextSize = 15,
	FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json"),
	TextXAlignment = Enum.TextXAlignment.Left,
	ClearTextOnFocus = false,
	Parent = content,
}, { Corner(10), Padding(10) })

local modeButton = New("TextButton", {
	AnchorPoint = Vector2.new(1, 0),
	Position = UDim2.fromScale(1, 0),
	Size = UDim2.fromOffset(140, 36),
	BackgroundColor3 = Theme.Surface,
	Text = "",
	TextColor3 = Theme.Text,
	TextSize = 14,
	FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.SemiBold),
	AutoButtonColor = false,
	Parent = content,
}, { Corner(10) })

local status = New("TextLabel", {
	Position = UDim2.fromOffset(0, 42),
	Size = UDim2.new(1, 0, 0, 18),
	BackgroundTransparency = 1,
	Text = "",
	TextColor3 = Theme.Muted,
	TextSize = 13,
	FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json"),
	TextXAlignment = Enum.TextXAlignment.Left,
	Parent = content,
})

local DETAIL_HEIGHT = 120

local grid = New("ScrollingFrame", {
	Position = UDim2.fromOffset(0, 66),
	Size = UDim2.new(1, 0, 1, -66 - DETAIL_HEIGHT - 8),
	BackgroundTransparency = 1,
	BorderSizePixel = 0,
	ScrollBarThickness = 4,
	ScrollBarImageColor3 = Theme.Border,
	AutomaticCanvasSize = Enum.AutomaticSize.Y,
	CanvasSize = UDim2.new(),
	Parent = content,
}, {
	New("UIGridLayout", {
		CellSize = UDim2.fromOffset(TILE, TILE),
		CellPadding = UDim2.fromOffset(6, 6),
		SortOrder = Enum.SortOrder.LayoutOrder,
	}),
})

-- Detail bar
local detail = New("Frame", {
	AnchorPoint = Vector2.new(0, 1),
	Position = UDim2.fromScale(0, 1),
	Size = UDim2.new(1, 0, 0, DETAIL_HEIGHT),
	BackgroundColor3 = Theme.Surface,
	BorderSizePixel = 0,
	Parent = content,
}, { Corner(10), Padding(16) })

local previewBox = New("Frame", {
	Size = UDim2.fromOffset(PREVIEW_SIZE + 8, PREVIEW_SIZE + 8),
	BackgroundColor3 = Theme.Background,
	BorderSizePixel = 0,
	Parent = detail,
}, { Corner(10) })

local detailName = New("TextLabel", {
	Position = UDim2.fromOffset(PREVIEW_SIZE + 22, 0),
	Size = UDim2.new(1, -(PREVIEW_SIZE + 26), 0, 22),
	BackgroundTransparency = 1,
	Text = "Select an icon",
	TextColor3 = Theme.Text,
	TextSize = 17,
	FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold),
	TextXAlignment = Enum.TextXAlignment.Left,
	TextTruncate = Enum.TextTruncate.AtEnd,
	Parent = detail,
})

local detailMeta = New("TextLabel", {
	Position = UDim2.fromOffset(PREVIEW_SIZE + 22, 26),
	Size = UDim2.new(1, -(PREVIEW_SIZE + 22), 0, 16),
	BackgroundTransparency = 1,
	Text = "",
	TextColor3 = Theme.Muted,
	TextSize = 13,
	FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json"),
	TextXAlignment = Enum.TextXAlignment.Left,
	Parent = detail,
})

local function ActionButton(text: string, x: number, primary: boolean): TextButton
	return New("TextButton", {
		Position = UDim2.new(0, PREVIEW_SIZE + 22 + x, 1, -34),
		Size = UDim2.fromOffset(116, 34),
		BackgroundColor3 = if primary then Theme.Accent else Theme.Surface2,
		Text = text,
		TextColor3 = if primary then Theme.AccentText else Theme.Text,
		TextSize = 14,
		FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.SemiBold),
		AutoButtonColor = false,
		Parent = detail,
	}, { Corner(16) })
end

local copyLuau = ActionButton("Copy Luau", 0, true)
local copyName = ActionButton("Copy name", 126, false)

--// Icons \\--
-- Puts an icon into a holder frame, as a font glyph when allowed and as a sprite otherwise
local function MountIcon(holder: GuiObject, name: string, size: number)
	local asset = Icons.GetAsset(name)
	if not asset then
		return
	end

	if state.UseFont and asset.FontFace then
		local label = New("TextLabel", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.5),
			Size = UDim2.fromOffset(size, size),
			BackgroundTransparency = 1,
			TextColor3 = Theme.Text,
			TextSize = math.min(100, size),
			Text = "",
			Parent = holder,
		})
		Draw(label, name)
	else
		local image = New("ImageLabel", {
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.5),
			Size = UDim2.fromOffset(size, size),
			BackgroundTransparency = 1,
			ImageColor3 = Theme.Text,
			Parent = holder,
		})
		Draw(image, name)
	end
end

local function ClearChildrenOfClass(parentInstance: Instance, class: string)
	for _, child in parentInstance:GetChildren() do
		if child:IsA(class) then
			child:Destroy()
		end
	end
end

local function Select(name: string?)
	state.Selected = name
	ClearChildrenOfClass(previewBox, "GuiObject")

	if not name then
		detailName.Text = "Select an icon"
		detailMeta.Text = ""
		return
	end

	local info = Icons.GetProviderInfo()
	detailName.Text = name
	detailMeta.Text = `{info.Name} - {info.License}`
	MountIcon(previewBox, name, PREVIEW_SIZE)
end

local function AddChunk()
	local results = state.Results
	local last = math.min(state.Shown + CHUNK, #results)

	for index = state.Shown + 1, last do
		local name = results[index]
		local tile = New("TextButton", {
			Name = name,
			LayoutOrder = index,
			BackgroundColor3 = Theme.Surface,
			Text = "",
			AutoButtonColor = false,
			Parent = grid,
		}, { Corner(10) })

		MountIcon(tile, name, 28)

		tile.MouseEnter:Connect(function()
			tile.BackgroundColor3 = Theme.Surface2
		end)
		tile.MouseLeave:Connect(function()
			tile.BackgroundColor3 = Theme.Surface
		end)
		tile.MouseButton1Click:Connect(function()
			Select(name)
		end)
	end

	state.Shown = last
end

local function SetStatus(text: string)
	status.Text = text
end

local function Refresh()
	ClearChildrenOfClass(grid, "TextButton")
	grid.CanvasPosition = Vector2.zero
	state.Shown = 0

	local names = Icons.GetIcons()
	local query = string.lower(state.Query)

	if query == "" then
		state.Results = names
	else
		local matches = {}
		for _, name in names do
			if string.find(name, query, 1, true) then
				table.insert(matches, name)
			end
		end
		state.Results = matches
	end

	AddChunk()

	local total = #names
	if #state.Results == 0 then
		SetStatus(`No icons match "{state.Query}"`)
	elseif query == "" then
		SetStatus(`{total} icons`)
	else
		SetStatus(`{#state.Results} of {total} icons`)
	end
end

local providerButtons = {}

local function RefreshProviderButtons()
	for id, button in providerButtons do
		local active = id == state.Provider
		button.BackgroundColor3 = if active then Theme.Accent else Theme.Surface2
		button.TextColor3 = if active then Theme.AccentText else Theme.Text
	end
end

local function RefreshModeButton()
	modeButton.Text = if state.UseFont then "Font icons" else "Sprites"
	modeButton.TextColor3 = if state.UseFont then Theme.Accent else Theme.Text
end

local function SwitchProvider(id: string)
	state.Token += 1
	local token = state.Token
	state.Provider = id
	RefreshProviderButtons()

	local info = Icons.GetProviderInfo(id)
	SetStatus(`Loading {info.Name}...`)
	ClearChildrenOfClass(grid, "TextButton")
	Select(nil)

	task.spawn(function()
		local loaded = pcall(Icons.SetProvider, id)
		if token ~= state.Token then
			return
		end
		if not loaded then
			SetStatus(`Could not load {info.Name}`)
			return
		end

		-- Download every font part up front so the grid does not stall while it fills
		SetStatus(`Downloading {info.Name} fonts...`)
		pcall(Icons.PreloadAsync)
		if token ~= state.Token then
			return
		end

		Refresh()
	end)
end

-- One button per provider
for order, id in Icons.Providers do
	local info = Icons.GetProviderInfo(id)
	local button = New("TextButton", {
		LayoutOrder = order,
		Size = UDim2.new(1, 0, 0, 34),
		BackgroundColor3 = Theme.Surface2,
		Text = `{info.Name}   {info.Count}`,
		TextColor3 = Theme.Text,
		TextSize = 14,
		FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.SemiBold),
		AutoButtonColor = false,
		Parent = providerList,
	}, { Corner(8) })

	providerButtons[id] = button
	button.MouseButton1Click:Connect(function()
		if id ~= state.Provider then
			SwitchProvider(id)
		end
	end)
end

--// Actions \\--
local function LuauFor(name: string): string
	local lines = {
		`local Icons = loadstring(game:HttpGet("{LOADER_URL}"))()`,
		`Icons.SetProvider("{state.Provider}")`,
		"",
	}

	if state.UseFont then
		table.insert(lines, `local label = Instance.new("TextLabel")`)
		table.insert(lines, `label.BackgroundTransparency = 1`)
		table.insert(lines, `label.Size = UDim2.fromOffset(24, 24)`)
		table.insert(lines, `label.TextSize = 24`)
		table.insert(lines, `label.TextColor3 = Color3.new(1, 1, 1)`)
		table.insert(lines, `Icons.SetIcon(label, "{name}")`)
	else
		table.insert(lines, `local image = Instance.new("ImageLabel")`)
		table.insert(lines, `image.BackgroundTransparency = 1`)
		table.insert(lines, `image.Size = UDim2.fromOffset(24, 24)`)
		table.insert(lines, `image.ImageColor3 = Color3.new(1, 1, 1)`)
		table.insert(lines, `Icons.SetIcon(image, "{name}")`)
	end

	return table.concat(lines, "\n")
end

-- Shows a short message in the status line, then puts the previous text back
local function Flash(message: string)
	local previous = status.Text
	SetStatus(message)
	task.delay(1.4, function()
		if status.Text == message then
			SetStatus(previous)
		end
	end)
end

copyLuau.MouseButton1Click:Connect(function()
	local name = state.Selected
	if not name then
		return Flash("Select an icon first")
	end
	Flash(if Copy(LuauFor(name)) then "Luau copied" else "Your executor has no clipboard function")
end)

copyName.MouseButton1Click:Connect(function()
	local name = state.Selected
	if not name then
		return Flash("Select an icon first")
	end
	Flash(if Copy(name) then "Name copied" else "Your executor has no clipboard function")
end)

modeButton.MouseButton1Click:Connect(function()
	state.UseFont = not state.UseFont
	RefreshModeButton()

	-- Redraw what is on screen in the new mode
	local selected = state.Selected
	local shown = state.Shown
	ClearChildrenOfClass(grid, "TextButton")
	state.Shown = 0
	while state.Shown < shown do
		AddChunk()
	end
	Select(selected)
end)

local searchToken = 0
searchBox:GetPropertyChangedSignal("Text"):Connect(function()
	searchToken += 1
	local token = searchToken
	task.delay(0.2, function()
		if token == searchToken then
			state.Query = searchBox.Text
			Refresh()
		end
	end)
end)

-- Load more tiles when the grid is scrolled near its end
grid:GetPropertyChangedSignal("CanvasPosition"):Connect(function()
	if state.Shown >= #state.Results then
		return
	end
	local remaining = grid.AbsoluteCanvasSize.Y - (grid.CanvasPosition.Y + grid.AbsoluteWindowSize.Y)
	if remaining < 300 then
		AddChunk()
	end
end)

--// Window behavior \\--
local connections: { RBXScriptConnection } = {}

closeButton.MouseButton1Click:Connect(function()
	for _, connection in connections do
		connection:Disconnect()
	end
	gui:Destroy()
end)

do
	local dragging, dragStart, startPosition

	titleBar.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = true
			dragStart = input.Position
			startPosition = window.Position
		end
	end)

	table.insert(connections, UserInputService.InputChanged:Connect(function(input)
		if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
			local delta = input.Position - dragStart
			window.Position = UDim2.new(
				startPosition.X.Scale,
				startPosition.X.Offset + delta.X,
				startPosition.Y.Scale,
				startPosition.Y.Offset + delta.Y
			)
		end
	end))

	table.insert(connections, UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = false
		end
	end))
end

--// Start \\--
RefreshModeButton()
SwitchProvider(state.Provider)
