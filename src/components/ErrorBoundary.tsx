import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-8 text-center dark:bg-gray-950">
          <div className="text-5xl">😵</div>
          <div>
            <h1 className="mb-2 text-xl font-bold text-gray-800 dark:text-gray-100">
              예상치 못한 오류가 발생했어요
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              작업 내용은 자동 저장되어 있습니다.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-left dark:border-gray-700 dark:bg-gray-900">
            <p className="font-mono text-xs text-red-500">{this.state.error.message}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              다시 시도
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              홈으로 이동
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
