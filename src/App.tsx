/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import AppMain from './components/AppMain';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AppMain />
      <Toaster />
    </ThemeProvider>
  );
}
