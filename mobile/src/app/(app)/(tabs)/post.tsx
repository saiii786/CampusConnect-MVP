/**
 * Placeholder for the "Post" tab: pressing the tab opens /listings/new instead (see (tabs)/_layout.tsx).
 * Only reached through a deep link to /post — then it forwards to the posting form.
 */
import { Redirect } from 'expo-router';

export default function PostTab() {
  return <Redirect href="/listings/new" />;
}
