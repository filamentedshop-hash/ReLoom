// CUTSCENES: STUB (every scene resolves immediately). The story agent
// replaces this file but must keep this shape:
//
//   cutscenes.play(sceneId) -> Promise   resolves when the scene is over or
//                                        skipped; MUST resolve immediately for
//                                        unknown ids and for scenes that should
//                                        not replay (use app.save.flag()).
//   cutscenes.active                     true while a scene is playing. play()
//                                        MUST set it synchronously (before it
//                                        returns) when it is going to show
//                                        something: the engine only waits for
//                                        the promise when active is true. While
//                                        true the app calls update/draw/pointer
//                                        on this object INSTEAD of updating the
//                                        current scene (which is still drawn
//                                        underneath first).
//   cutscenes.update(app) / draw(ctx, app) / pointer(app, kind, x, y)
//
// Scene ids the engine asks for:
//   'intro'        first time the player leaves the title screen
//   'w{N}_intro'   entering world N          'w{N}_boss'  boss arena starts
//   'w{N}_clear'   world N finished (before the clear screen)
export const cutscenes = {
  active: false,
  play(sceneId) { return Promise.resolve(sceneId); },
  update(app) {},
  draw(ctx, app) {},
  pointer(app, kind, x, y) {},
};
