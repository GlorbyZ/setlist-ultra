import * as Linking from 'expo-linking';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, View, type GestureResponderEvent } from 'react-native';

import { BrandDialog } from '@/src/components/BrandDialog';
import { composeBugReportMailto } from '@/src/lib/bugReport';

type Props = { children: ReactNode };

export function BugReportHost({ children }: Props) {
  const [open, setOpen] = useState(false);
  const locked = useRef(false);

  const openReport = () => {
    if (locked.current) return;
    locked.current = true;
    setOpen(true);
  };

  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    let lastPeak = 0;
    let peaks = 0;
    let cancelled = false;

    void (async () => {
      try {
        const sensors = await import('expo-sensors');
        const available = await sensors.Accelerometer.isAvailableAsync();
        if (!available || cancelled) return;
        sensors.Accelerometer.setUpdateInterval(80);
        sub = sensors.Accelerometer.addListener(({ x, y, z }) => {
          const mag = Math.sqrt(x * x + y * y + z * z);
          if (mag < 2.4) return;
          const now = Date.now();
          if (now - lastPeak > 900) peaks = 0;
          if (now - lastPeak < 70) return;
          lastPeak = now;
          peaks += 1;
          if (peaks >= 4) {
            peaks = 0;
            openReport();
          }
        });
      } catch {
        /* Native sensors are not in this binary — three-finger tap still works. */
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  const onTouchStart = (event: GestureResponderEvent) => {
    if (event.nativeEvent.touches.length >= 3) openReport();
  };

  return (
    <View style={{ flex: 1 }} onTouchStart={Platform.OS === 'web' ? undefined : onTouchStart}>
      {children}
      <BrandDialog
        visible={open}
        title="Report a bug"
        body="Describe what you were doing. Email opens with app version and recent errors — no songs or charts."
        onClose={() => {
          setOpen(false);
          locked.current = false;
        }}
        actions={[
          {
            label: 'Cancel',
            onPress: () => {
              setOpen(false);
              locked.current = false;
            },
          },
          {
            label: 'Email report',
            onPress: () => {
              setOpen(false);
              locked.current = false;
              void Linking.openURL(composeBugReportMailto());
            },
          },
        ]}
      />
    </View>
  );
}
