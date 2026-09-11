import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { config } from './config';

const recent: string[] = [];

export function noteAppError(message: string) {
  const line = `${new Date().toISOString()} ${message.trim()}`;
  recent.push(line);
  if (recent.length > 12) recent.shift();
}

export function recentAppErrors() {
  return recent.slice();
}

export function composeBugReportMailto() {
  const version = Constants.expoConfig?.version ?? '?';
  const native = Constants.nativeAppVersion ?? Constants.nativeBuildVersion;
  const lines = [
    'What happened:',
    '',
    '',
    '--- device ---',
    `Setlist Ultra ${version}`,
    native ? `Native ${native}` : '',
    `${Platform.OS} ${Platform.Version}`,
    typeof __DEV__ !== 'undefined' && __DEV__ ? 'Metro / dev client' : 'Release',
    '',
    '--- recent errors ---',
    ...(recent.length ? recent : ['(none captured yet)']),
  ].filter((line) => line !== '');
  const body = lines.join('\n');
  return `mailto:${config.supportEmail}?subject=${encodeURIComponent('Setlist Ultra bug')}&body=${encodeURIComponent(body)}`;
}
