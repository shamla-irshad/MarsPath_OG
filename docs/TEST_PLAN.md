# MarsPath manual acceptance checklist

After starting both servers, open http://127.0.0.1:5173 on a laptop/desktop browser.

1. **Homepage:** One clear Explore Mars CTA; nav links, How it Works anchor. No device/laptop frame.
2. **Mission Discovery:** Mission A/B/C all present. Each returns three candidate cards with actual team attributes. Search by name works. Choosing A/B/C enables Continue; Rover Navigation also allows Continue without a candidate for custom map tapping.
3. **Rover → Map:** Jezero imagery loads; map displays chosen candidate and landing marker; overlays can be toggled and opacity adjusted. Tap a valid grid target to calculate and overlay both real A* routes immediately (without selecting A/B/C).
4. **Camera:** Zoom Out three times and verify that the map stays zoomed out. Drag it and ensure it does not snap back. Change layer visibility; camera remains unchanged. Follow Position defaults OFF.
5. **Route:** With backend running, tap JEZERO_A/B/C in the left panel to calculate and show routes automatically. Then tap any open background cell to switch to a custom destination; both actual A* paths appear in the map and compare screen. Compare distance, modeled cost, exposure. If results match, do not imply a nonexistent difference.
6. **Navigation:** Choose route, Start, Pause, Resume, Stop; route marker follows returned geometry. Verify follow toggle OFF/ON, manually zoom to disable following. Stop does not imply completion.
7. **Manual position:** Set valid grid coordinates and verify marker moves; a large off-route distance creates a *possible deviation* advisory. Simulate off-route and clear it.
8. **Navigation end:** Exit before completing and see incomplete status in the report. If simulation reaches 100%, completion is correctly recorded.
9. **Water-Ice:** Choose Arcadia candidate, view schematic polygon + actual SWIM metrics. No fake route button. Open science summary.
10. **Past-Life:** Choose a sample site; view geological details and source links, and note coordinate uncertainty for LIFE_002/003. Open science summary.
11. **Back and Home:** Return from science summary to map, change mission and return Home. Changing selected science candidate invalidates the prior route. Plan another mission starts clean.
12. **Backend offline:** Stop FastAPI. Refresh, ensure local candidate cards still load but Rover Generate Routes is unavailable; no fake success or route geometry appears.
13. **Device sizes:** Check ~1440px, 1024px, 768px and ~390px widths for no horizontal page overflow and reachable controls.
14. **Scientific integrity:** No live GPS, live environmental monitoring, confirmed ice, proven life, or certified astronaut safety claim.

Automated code checks:

```bash
# The suite uses pytest fixtures, so run it with pytest. `unittest discover`
# silently collects 0 tests from the session, regional-route and science modules.
cd backend && python -m pip install -r requirements-dev.txt && python -m pytest -v
cd frontend && npm run typecheck && npm run build
```

## New tap-to-route acceptance tests

15. **Original example route:** Click `Try example route (210,215)` on the Jezero map. Check that the route begins at (200,200), ends at (210,215), and is labeled as a demo destination rather than JEZERO_A/B/C.
16. **Arbitrary point:** Click an open point within the visible 2 km square, away from A/B/C. The right panel must say Custom destination, the A* line must appear, and the destination grid row/column must update.
17. **Two route options:** After a tap, choose `Shortest route` and `Lower-terrain-cost route`; verify the highlighted polyline and route metrics change. Click `Compare both routes`.
18. **Blocked cell:** Use a blocked cell such as grid (0,0), or tap a blocked area with overlay enabled. The UI must report blocked/unknown terrain and must not display a successful route.
19. **Outside grid:** Tap outside the square Jezero image. The interface must explain that terrain data is unavailable; it must never invent a route.
20. **Other missions:** Switch to Arcadia or Past-Life. The science candidates still display, but the map must not offer this Jezero-only tap-to-route capability.
21. **Touch and drag:** On a touch device, tapping picks a point, while dragging pans the map without accidentally calculating a new route.
