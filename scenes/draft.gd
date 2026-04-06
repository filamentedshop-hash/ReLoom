# res://scenes/Draft.gd
extends Node2D

enum Tool { LINE, RECT, DIMENSION }

class LineSeg:
	var a: Vector2
	var b: Vector2
	func _init(a_: Vector2, b_: Vector2) -> void:
		a = a_
		b = b_

class RectDef:
	var a: Vector2
	var b: Vector2
	func _init(a_: Vector2, b_: Vector2) -> void:
		a = a_
		b = b_

class DimensionInfo:
	var a: Vector2
	var b: Vector2
	var len: float
	var mid: Vector2
	var normal: Vector2
	func _init(a_: Vector2, b_: Vector2, len_: float, mid_: Vector2, normal_: Vector2) -> void:
		a = a_
		b = b_
		len = len_
		mid = mid_
		normal = normal_

var tool: Tool = Tool.LINE
var snap: float = 4.0

var is_dragging: bool = false
var start: Vector2 = Vector2.ZERO
var current: Vector2 = Vector2.ZERO

var lines: Array[LineSeg] = []
var rects: Array[RectDef] = []

# Nullable typed object reference (strict-typing friendly)
var last_dimension: DimensionInfo = null

func _ready() -> void:
	# Ensures _input is called.
	set_process_input(true)

func _input(event: InputEvent) -> void:
	# Tool hotkeys + clear (same behavior as before)
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_1:
				tool = Tool.LINE
				last_dimension = null
				queue_redraw()
			KEY_2:
				tool = Tool.RECT
				last_dimension = null
				queue_redraw()
			KEY_3:
				tool = Tool.DIMENSION
				queue_redraw()
			KEY_C:
				lines.clear()
				rects.clear()
				last_dimension = null
				queue_redraw()

	# Mouse down/up for drawing + dimension picking
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			var p: Vector2 = _snap_pos(get_local_mouse_position())

			if tool == Tool.DIMENSION:
				_pick_dimension(p)
				queue_redraw()
				return

			is_dragging = true
			start = p
			current = p
			queue_redraw()
		else:
			if not is_dragging:
				return

			is_dragging = false
			current = _snap_pos(get_local_mouse_position())

			if tool == Tool.LINE:
				if start.distance_to(current) >= 1.0:
					lines.append(LineSeg.new(start, current))
			elif tool == Tool.RECT:
				if start.distance_to(current) >= 1.0:
					rects.append(RectDef.new(start, current))

			queue_redraw()

	# Mouse move preview while dragging
	if event is InputEventMouseMotion and is_dragging:
		current = _snap_pos(get_local_mouse_position())
		queue_redraw()

func _snap_pos(p: Vector2) -> Vector2:
	return Vector2(
		round(p.x / snap) * snap,
		round(p.y / snap) * snap
	)

func _draw() -> void:
	_draw_grid()
	_draw_geometry()

	# Preview while dragging
	if is_dragging and tool != Tool.DIMENSION:
		if tool == Tool.LINE:
			_draw_line_segment(start, current, Color(0.9, 0.9, 0.9), 2.0)
		elif tool == Tool.RECT:
			_draw_rect_from(start, current, Color(0.9, 0.9, 0.9), 2.0)

	# Draw last dimension overlay
	if last_dimension != null:
		_draw_dimension(last_dimension)

func _draw_grid() -> void:
	var size: Vector2 = get_viewport_rect().size
	var minor: Color = Color(1, 1, 1, 0.06)

	var step: int = int(snap)
	for x in range(0, int(size.x) + 1, step):
		draw_line(Vector2(float(x), 0.0), Vector2(float(x), size.y), minor, 1.0)
	for y in range(0, int(size.y) + 1, step):
		draw_line(Vector2(0.0, float(y)), Vector2(size.x, float(y)), minor, 1.0)

func _draw_geometry() -> void:
	var ink: Color = Color(0.95, 0.95, 0.95)

	for l: LineSeg in lines:
		_draw_line_segment(l.a, l.b, ink, 2.0)

	for r: RectDef in rects:
		_draw_rect_from(r.a, r.b, ink, 2.0)

func _draw_line_segment(a: Vector2, b: Vector2, col: Color, w: float) -> void:
	draw_line(a, b, col, w)

func _draw_rect_from(a: Vector2, b: Vector2, col: Color, w: float) -> void:
	var pos: Vector2 = Vector2(min(a.x, b.x), min(a.y, b.y))
	var size: Vector2 = Vector2(abs(a.x - b.x), abs(a.y - b.y))
	draw_rect(Rect2(pos, size), col, false, w)

func _pick_dimension(p: Vector2) -> void:
	var found: bool = false
	var best_d: float = 999999.0
	var best_a: Vector2 = Vector2.ZERO
	var best_b: Vector2 = Vector2.ZERO

	# check explicit lines
	for l: LineSeg in lines:
		var d: float = _distance_point_to_segment(p, l.a, l.b)
		if d < best_d:
			best_d = d
			best_a = l.a
			best_b = l.b
			found = true

	# check rectangle edges
	for r: RectDef in rects:
		var ra: Vector2 = r.a
		var rb: Vector2 = r.b

		var x1: float = min(ra.x, rb.x)
		var x2: float = max(ra.x, rb.x)
		var y1: float = min(ra.y, rb.y)
		var y2: float = max(ra.y, rb.y)

		var e1a: Vector2 = Vector2(x1, y1); var e1b: Vector2 = Vector2(x2, y1)
		var e2a: Vector2 = Vector2(x2, y1); var e2b: Vector2 = Vector2(x2, y2)
		var e3a: Vector2 = Vector2(x2, y2); var e3b: Vector2 = Vector2(x1, y2)
		var e4a: Vector2 = Vector2(x1, y2); var e4b: Vector2 = Vector2(x1, y1)

		var d1: float = _distance_point_to_segment(p, e1a, e1b)
		if d1 < best_d:
			best_d = d1; best_a = e1a; best_b = e1b; found = true

		var d2: float = _distance_point_to_segment(p, e2a, e2b)
		if d2 < best_d:
			best_d = d2; best_a = e2a; best_b = e2b; found = true

		var d3: float = _distance_point_to_segment(p, e3a, e3b)
		if d3 < best_d:
			best_d = d3; best_a = e3a; best_b = e3b; found = true

		var d4: float = _distance_point_to_segment(p, e4a, e4b)
		if d4 < best_d:
			best_d = d4; best_a = e4a; best_b = e4b; found = true

	# Threshold: must click “near” the segment
	if (not found) or best_d > 10.0:
		last_dimension = null
		return

	var len: float = best_a.distance_to(best_b)
	var mid: Vector2 = (best_a + best_b) * 0.5
	var dir: Vector2 = (best_b - best_a).normalized()
	var normal: Vector2 = Vector2(-dir.y, dir.x)

	last_dimension = DimensionInfo.new(best_a, best_b, len, mid, normal)

func _draw_dimension(d: DimensionInfo) -> void:
	var a: Vector2 = d.a
	var b: Vector2 = d.b
	var len: float = d.len
	var mid: Vector2 = d.mid
	var n: Vector2 = d.normal

	# Offset the dimension line away from the measured segment
	var off: float = 12.0
	var da: Vector2 = a + n * off
	var db: Vector2 = b + n * off

	var col: Color = Color(0.7, 0.9, 1.0)
	draw_line(da, db, col, 2.0)

	# extension lines
	draw_line(a, da, col, 1.0)
	draw_line(b, db, col, 1.0)

	# end ticks
	var tick: float = 6.0
	var tdir: Vector2 = (db - da).normalized()
	var tn: Vector2 = Vector2(-tdir.y, tdir.x)
	draw_line(da - tn * tick * 0.5, da + tn * tick * 0.5, col, 2.0)
	draw_line(db - tn * tick * 0.5, db + tn * tick * 0.5, col, 2.0)

	# label
	var txt: String = "%d px" % int(round(len))
	draw_string(
		ThemeDB.fallback_font,
		mid + n * (off + 14.0),
		txt,
		HORIZONTAL_ALIGNMENT_CENTER,
		-1,
		14,
		col
	)

func _distance_point_to_segment(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab: Vector2 = b - a
	var denom: float = ab.length_squared()
	var t: float = 0.0
	if denom > 0.0:
		t = clamp((p - a).dot(ab) / denom, 0.0, 1.0)
	var proj: Vector2 = a + ab * t
	return p.distance_to(proj)
