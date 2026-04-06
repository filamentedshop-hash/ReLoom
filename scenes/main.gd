extends Node
enum Screen { HOUSE, ATTIC, SKETCH }
var current: Node = null
func _ready() -> void:
	switch_to(Screen.HOUSE)
func switch_to(screen: Screen) -> void:
	if current:
		current.queue_free()
	match screen:
		Screen.HOUSE:
			current = preload("res://scenes/House.tscn").instantiate()
		Screen.ATTIC:
			current = preload("res://scenes/Attic.tscn").instantiate()
		Screen.SKETCH:
			current = preload("res://scenes/SketchCanvas.tscn").instantiate()
	add_child(current)
