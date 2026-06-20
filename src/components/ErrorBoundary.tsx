import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ShadowNote] 页面渲染出错', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-page">
          <div className="error-card">
            <h1>页面加载出错</h1>
            <p>{this.state.error.message}</p>
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              刷新重试
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
