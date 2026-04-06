extends Node2D
@onready var vera_text: Label = $Computer/Screen/VeraText
@onready var hint: Label = $Hint
var revealed := false
var t := 0.0
func _ready() -> void:
	vera_text.text = ""
	hint.text = "Press Space to wake the computer\nPress S for Sketch Canvas\nPress Esc to go back"
func _process(delta: float) -> void:
	if revealed:
		t += delta
		var a := 0.75 + 0.25 * sin(t * 3.0)
		vera_text.modulate.a = a
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_ESCAPE:
				get_tree().root.get_node("Main").switch_to(get_tree().root.get_node("Main").Screen.HOUSE)
			KEY_SPACE:
				reveal_vera()
			KEY_S:
				get_tree().root.get_node("Main").switch_to(get_tree().root.get_node("Main").Screen.SKETCH)
func reveal_vera() -> void:
	if revealed:
		return
	revealed = true
	vera_text.modulate = Color(1, 1, 1, 1)
	vera_text.text = "...hello?\nI'm Vera.\nCan you rebuild my world?"
