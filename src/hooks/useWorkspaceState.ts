import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

type WorkspaceIdentity = {
  workspaceId: string | null;
  generation: number;
};

type WorkspaceState<T> = {
  identity: WorkspaceIdentity;
  value: T;
};

/**
 * Own state on behalf of one workspace identity.
 *
 * The returned value becomes `emptyValue` during the render that switches
 * workspaces, before effects have a chance to clear the previous value. Setters
 * created by the old render are fenced too, so late mutations and realtime
 * callbacks cannot replace the new workspace's state. Unlike React's native
 * setter, this setter intentionally changes identity with the workspace; any
 * callback that captures it must include it (or workspaceId) in its dependencies.
 */
export function useWorkspaceState<T>(
  workspaceId: string | null,
  initialValue: T,
  emptyValue: T,
): [T, Dispatch<SetStateAction<T>>, () => () => boolean] {
  const identityRef = useRef<WorkspaceIdentity>({ workspaceId, generation: 0 });
  if (identityRef.current.workspaceId !== workspaceId) {
    identityRef.current = {
      workspaceId,
      generation: identityRef.current.generation + 1,
    };
  }
  const identity = identityRef.current;
  const requestSequenceRef = useRef(0);
  const [state, setState] = useState<WorkspaceState<T>>(() => ({ identity, value: initialValue }));

  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setState(current => {
      if (identityRef.current !== identity) return current;
      const previous = current.identity === identity ? current.value : emptyValue;
      const value = typeof action === 'function'
        ? (action as (previousValue: T) => T)(previous)
        : action;
      // React bails out of the re-render when a setter returns the state it was
      // handed; a freshly allocated wrapper is never Object.is-equal to the old
      // one, so without this line that bailout was unreachable for every
      // consumer. Realtime handlers lean on it constantly ("return prev" when a
      // row we already hold arrives again, when a payload belongs to another
      // workspace, when a poll finds nothing new) and these hooks are mounted at
      // the App root, so each of those no-ops re-rendered the whole tree.
      // The identity half of the check keeps the workspace fence exact: a
      // wrapper still stamped with a PREVIOUS identity has to be replaced even
      // when its value happens to be identical, or the read below would go on
      // answering `emptyValue` forever.
      if (current.identity === identity && Object.is(current.value, value)) return current;
      return { identity, value };
    });
  }, [emptyValue, identity]);

  const beginRequest = useCallback(() => {
    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    return () => identityRef.current === identity && requestSequenceRef.current === sequence;
  }, [identity]);

  return [state.identity === identity ? state.value : emptyValue, setValue, beginRequest];
}

export function useWorkspaceListState<T>(
  workspaceId: string | null,
  initialValue: T[],
): [T[], Dispatch<SetStateAction<T[]>>, () => () => boolean] {
  const emptyValue = useRef<T[]>([]);
  return useWorkspaceState(workspaceId, initialValue, emptyValue.current);
}
