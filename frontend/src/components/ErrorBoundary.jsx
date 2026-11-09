import { Component } from 'react'

// Catches a render error in any page below it and shows a message with a
// retry button, instead of leaving the user on a blank white page. App.jsx
// keys it by route, so navigating to another page resets it automatically.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    const { title, message, retryLabel } = this.props
    return (
      <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-5 py-4 text-sm text-badge-danger-fg" role="alert">
        <p className="font-semibold">{title}</p>
        <p className="mt-1">{message}</p>
        <button type="button" className="btn-primary mt-3" onClick={() => this.setState({ failed: false })}>
          {retryLabel}
        </button>
      </div>
    )
  }
}
