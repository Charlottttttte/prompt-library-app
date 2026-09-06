"use client";

import { useFormStatus } from "react-dom";
import { buttonStyles } from "./ui";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonStyles.danger}>
      {pending ? "Deleting…" : label}
    </button>
  );
}

/**
 * Deleting is irreversible, so it asks first. Without JS the confirm never
 * fires and the form still posts — the action itself is the source of truth.
 */
export function DeleteButton({
  action,
  id,
  idField = "id",
  label = "Delete",
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  idField?: string;
  label?: string;
  confirmMessage: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <input type="hidden" name={idField} value={id} />
      <SubmitButton label={label} />
    </form>
  );
}
