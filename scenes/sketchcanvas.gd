extends Control
@onready var help: Label = $Help
@onready var status: Label = $Status
@onready var draft: Node2D = $Draft
func _ready() -> void:
	help.text = "[1] Line  [2] Rect  [3] Dimension  [C] Clear  [Esc] Back to Attic"
	status.text = ""
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_tree().root.get_node("Main").switch_to(get_tree().root.get_node("Main").Screen.ATTIC)
