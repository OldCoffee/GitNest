import { useCallback, useState } from "react";
import { useSettings } from "./useRepo";

/**
 * Respects settings.confirm_discard: when true, caller shows ConfirmDialog via
 * `pending`; when false, runs the action immediately.
 */
export function useDiscardConfirm() {
  const { data: settings } = useSettings();
  const confirmEnabled = settings?.confirm_discard ?? true;
  const [pending, setPending] = useState<{
    message: string;
    run: () => void;
  } | null>(null);

  const requestDiscard = useCallback(
    (message: string, run: () => void | Promise<void>) => {
      const execute = () => {
        void Promise.resolve(run());
      };
      if (!confirmEnabled) {
        execute();
        return;
      }
      setPending({ message, run: execute });
    },
    [confirmEnabled],
  );

  const cancel = useCallback(() => setPending(null), []);

  const confirm = useCallback(() => {
    if (!pending) return;
    const { run } = pending;
    setPending(null);
    run();
  }, [pending]);

  return { pending, requestDiscard, cancel, confirm, confirmEnabled };
}
