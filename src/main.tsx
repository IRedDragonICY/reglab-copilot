
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const root = document.getElementById('root');

window.addEventListener('error', (e) => {
  root.innerHTML = '<div style="color:red; background:white; padding: 20px; z-index:9999; position:absolute; top:0; left:0; right:0; bottom:0;"><h1>Global Error</h1><pre>' + e.error?.stack + '</pre></div>';
});

import('./App').then((m) => {
  const App = m.default;
  class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }
    componentDidCatch(error, info) {
      console.error('GLOBAL ERROR:', error, info);
    }
    render() {
      if (this.state.hasError) {
        return (
          <div style={{ color: 'red', padding: '20px', zIndex: 9999, position: 'relative', background: 'white' }}>
            <h1>Something went wrong.</h1>
            <pre>{this.state.error.toString()}</pre>
            <pre>{this.state.error.stack}</pre>
          </div>
        );
      }
      return this.props.children;
    }
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <App />
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
}).catch(e => {
  root.innerHTML = '<div style="color:red; background:white; padding: 20px; z-index:9999; position:absolute; top:0; left:0; right:0; bottom:0;"><h1>Import Error</h1><pre>' + e.stack + '</pre></div>';
});
