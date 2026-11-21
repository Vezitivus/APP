"use client";

import { useState } from "react";

export function PinField({
  label,
  value,
  onChange,
  autoComplete = "off",
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  name?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <span className="pin-field">
        <input
          type={show ? "text" : "password"}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={autoComplete}
          maxLength={4}
          minLength={4}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
          required
        />
        <button className="btn-ghost pin-toggle" type="button" onClick={() => setShow((current) => !current)}>
          {show ? "Slēpt" : "Rādīt"}
        </button>
      </span>
    </label>
  );
}
