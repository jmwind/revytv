import { css, unsafeHTML } from 'remix/component'
import type { Handle } from 'remix/component'

const WINDY_KEY = 'LgEGmQsKdyOlCvJV0if03ay1ZcMEyb83'

const INIT = `
windyInit({ key: ${JSON.stringify(WINDY_KEY)}, lat: 50.9981, lon: -118.1957, zoom: 7, overlay: 'snowAccu', particlesAnim: 'off' }, function (api) {
  api.map.scrollWheelZoom.disable();
  setTimeout(function () {
    api.store.set('animation', true);
    var play = document.getElementById('playpause');
    if (play) play.click();
  }, 1500);
});
`

const style = css({
  overflow: 'hidden',
  '& #windy': { height: 'clamp(360px, 48vw, 620px)', background: 'var(--panel-2)' },
})

// Windy's forecast map. It owns #windy and loads after the page; the inline init is the vendor's documented API.
export function WindyMap(_handle: Handle) {
  return () => (
    <section class="panel" aria-label="Windy snow accumulation forecast map" mix={style}>
      <div id="windy"></div>
      <script src="https://unpkg.com/leaflet@1.4.0/dist/leaflet.js"></script>
      <script src="https://api.windy.com/assets/map-forecast/libBoot.js"></script>
      <script innerHTML={unsafeHTML(INIT)}></script>
    </section>
  )
}
