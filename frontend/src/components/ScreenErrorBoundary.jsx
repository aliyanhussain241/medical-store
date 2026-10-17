import { Component } from 'react';

export default class ScreenErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-page">
          <section className="auth-card" role="alert" data-screen-error>
            <h1>This page could not be displayed.</h1>
            <p>Reload the page to try again.</p>
            <button type="button" className="btn btn-brand" onClick={() => window.location.reload()}>
              Reload
            </button>
          </section>
        </div>
      );
    }
    return this.props.children;
  }
}
