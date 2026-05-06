"use client"

import React from "react"
import { CircleAlert } from "lucide-react"

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ai-elements/code-block"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ErrorBoundaryProps = {
  children: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error?: Error
  componentStack?: string
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Unhandled UI error caught by ErrorBoundary", error, errorInfo)
    this.setState({ componentStack: errorInfo.componentStack ?? undefined })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const errorName = this.state.error?.name || "Error"
      const errorMessage = this.state.error?.message?.trim() || "Unknown runtime error"
      const errorStack = this.state.error?.stack?.trim() || "No JavaScript stack trace available."
      const componentStack = this.state.componentStack?.trim() || "No React component stack available."

      return (
        <Dialog open>
          <DialogContent className="w-[min(92vw,56rem)] max-w-[56rem] min-w-0" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Application Error</DialogTitle>
              <DialogDescription>
                A runtime error occurred. You can reload the app after reviewing the details.
              </DialogDescription>
            </DialogHeader>

            <Alert variant="destructive" className="border-destructive/40 bg-card px-4 py-3">
              <CircleAlert className="size-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>
                <p className="font-medium">
                  {errorName}: {errorMessage}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Full details are shown below and also available in the browser console.
                </p>
              </AlertDescription>
            </Alert>

            <div className="min-w-0 space-y-3">
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  JavaScript stack
                </p>
                <CodeBlock code={errorStack} language="tsx" className="max-h-40 min-w-0 max-w-full">
                  <CodeBlockHeader>
                    <CodeBlockTitle>
                      <CodeBlockFilename>javascript-stack.txt</CodeBlockFilename>
                    </CodeBlockTitle>
                    <CodeBlockActions>
                      <CodeBlockCopyButton />
                    </CodeBlockActions>
                  </CodeBlockHeader>
                </CodeBlock>
              </div>

              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  React component stack
                </p>
                <CodeBlock code={componentStack} language="tsx" className="max-h-40 min-w-0 max-w-full">
                  <CodeBlockHeader>
                    <CodeBlockTitle>
                      <CodeBlockFilename>react-component-stack.txt</CodeBlockFilename>
                    </CodeBlockTitle>
                    <CodeBlockActions>
                      <CodeBlockCopyButton />
                    </CodeBlockActions>
                  </CodeBlockHeader>
                </CodeBlock>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={this.handleReload}>Reload app</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )
    }

    return this.props.children
  }
}

export { ErrorBoundary }
