import { useEffect, useState } from 'react';

import { useDisplayPrefs } from './DisplayPrefsProvider';

/** Session zoom / lyrics-only, seeded from saved Look & Stage prefs. */
export function useLiveChartSession() {
  const { prefs } = useDisplayPrefs();
  const [fontSize, setFontSize] = useState(prefs.chartFontSize);
  const [hideChords, setHideChords] = useState(prefs.lyricsOnlyDefault);

  useEffect(() => {
    setFontSize(prefs.chartFontSize);
  }, [prefs.chartFontSize]);

  useEffect(() => {
    setHideChords(prefs.lyricsOnlyDefault);
  }, [prefs.lyricsOnlyDefault]);

  return { prefs, fontSize, setFontSize, hideChords, setHideChords };
}
