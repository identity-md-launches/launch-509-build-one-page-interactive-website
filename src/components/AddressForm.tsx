import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { resolveInputKind } from '../lib/blockscout';

interface AddressFormProps {
  initialValue: string;
  loading: boolean;
  loadingText: string | null;
  onSubmit: (query: string) => void;
  onSample: () => void;
}

const INVALID_MESSAGE = 'Enter a 42-character address that starts with 0x, or an ENS name that ends in .eth.';

export function AddressForm({ initialValue, loading, loadingText, onSubmit, onSample }: AddressFormProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (resolveInputKind(trimmed) === 'invalid') {
      setError(INVALID_MESSAGE);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  return (
    <form className="address-form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
      <label className="address-form__label" htmlFor={inputId}>
        Ethereum address or ENS name
      </label>
      <div className="address-form__row">
        <input
          ref={inputRef}
          id={inputId}
          className="address-form__input"
          name="address"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="0x… or name.eth"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        />
        <div className="address-form__actions">
          <button type="submit" className="button button--primary" disabled={loading}>
            {loading && <span className="spinner" aria-hidden="true" />}
            Map activity
          </button>
          <button type="button" className="button button--ghost" onClick={onSample} disabled={loading}>
            Try a sample
          </button>
        </div>
      </div>
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <p id={hintId} className="address-form__hint">
        {loading && loadingText
          ? loadingText
          : 'Reads public Ethereum mainnet data from Blockscout. No wallet connection, keys or signatures are needed.'}
      </p>
    </form>
  );
}
