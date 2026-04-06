extends Node2D

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_accept"):
		get_tree().root.get_node("Main").switch_to(get_tree().root.get_node("Main").Screen.ATTIC)
