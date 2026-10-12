import { Component, lazy, Suspense, type ReactNode } from 'react';
import type { DoomSceneProps } from './DoomScene';

// What the shared 3D stage renders (see stage.ts): the scene, loaded on demand, with a guard that reports
// a crash instead of breaking the page. UI only.

const DoomScene = lazy(() => import('./DoomScene'));

class Guard extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function StageRoot(props: DoomSceneProps) {
  return (
    <Guard onFail={props.onLost}>
      <Suspense fallback={null}>
        <DoomScene {...props} />
      </Suspense>
    </Guard>
  );
}
