import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const SAMPLE_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  window.location.hash = '';
  vi.restoreAllMocks();
});

async function loadSample(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Try a sample' }));
  await screen.findByRole('heading', { name: 'vitalik.eth' }, { timeout: 5000 });
}

describe('Wallet Constellation', () => {
  it('shows an inline error for a malformed address and keeps focus on the field', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText('Ethereum address or ENS name');
    await user.type(input, 'not-an-address');
    await user.click(screen.getByRole('button', { name: 'Map activity' }));
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Enter a 42-character address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveFocus();
  });

  it('loads the bundled sample and renders stats, map, filters and counterparties', async () => {
    const user = userEvent.setup();
    await loadSample(user);

    expect(window.location.hash).toBe('#sample');
    const stats = screen.getByRole('region', { name: 'Activity summary' });
    expect(within(stats).getByText('Recent transactions')).toBeInTheDocument();
    expect(within(stats).getByText('Unique counterparties')).toBeInTheDocument();
    expect(within(stats).getByText('Contract interactions')).toBeInTheDocument();
    expect(within(stats).getByText('Most active day')).toBeInTheDocument();

    const map = screen.getByRole('group', { name: /Constellation of \d+ counterparties around vitalik\.eth/ });
    const stars = within(map).getAllByRole('button');
    expect(stars.length).toBeGreaterThan(20);

    expect(screen.getByRole('checkbox', { name: /Outgoing/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Incoming/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Contract interactions/ })).toBeChecked();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('filters the map and stats when a category is switched off', async () => {
    const user = userEvent.setup();
    await loadSample(user);
    const map = screen.getByRole('group', { name: /Constellation/ });
    const before = within(map).getAllByRole('button').length;

    await user.click(screen.getByRole('checkbox', { name: /Contract interactions/ }));
    expect(screen.getByRole('checkbox', { name: /Contract interactions/ })).not.toBeChecked();
    const after = within(map).getAllByRole('button').length;
    expect(after).toBeLessThan(before);
    expect(within(map).queryAllByText(/, contract,/)).toHaveLength(0);
    expect(screen.getByText(/Filters hide \d+ interactions of \d+/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show everything' }));
    expect(within(map).getAllByRole('button').length).toBe(before);
  });

  it('shows an empty-filter state when every category is off', async () => {
    const user = userEvent.setup();
    await loadSample(user);
    await user.click(screen.getByRole('checkbox', { name: /Outgoing/ }));
    await user.click(screen.getByRole('checkbox', { name: /Incoming/ }));
    expect(await screen.findByText('No stars match these filters')).toBeInTheDocument();
  });

  it('selects a star with the keyboard and shows its details with a copy button', async () => {
    const user = userEvent.setup();
    await loadSample(user);
    const map = screen.getByRole('group', { name: /Constellation/ });
    const [firstStar] = within(map).getAllByRole('button');
    act(() => firstStar!.focus());
    await user.keyboard('{Enter}');
    expect(firstStar).toHaveAttribute('aria-pressed', 'true');

    const details = screen.getByRole('complementary', { name: 'Details' });
    expect(within(details).getByRole('button', { name: 'Clear selection' })).toBeInTheDocument();
    await user.click(within(details).getByRole('button', { name: /^Copy: address 0x/ }));
    // user-event installs a clipboard stub, so the copied text can be read back.
    expect(await navigator.clipboard.readText()).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(await within(details).findByRole('button', { name: /^Copied: address/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copied address to the clipboard.'));

    // Escape on a focused star clears the selection.
    act(() => firstStar!.focus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(firstStar).toHaveAttribute('aria-pressed', 'false'));
  });

  it('selects a counterparty from the table', async () => {
    const user = userEvent.setup();
    await loadSample(user);
    const table = screen.getByRole('table');
    const rowButtons = within(table).getAllByRole('button', { pressed: false });
    await user.click(rowButtons[0]!);
    expect(rowButtons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeInTheDocument();
  });

  it('reports a network failure with a retry action', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<App />);
    await user.type(screen.getByLabelText('Ethereum address or ENS name'), SAMPLE_ADDRESS);
    await user.click(screen.getByRole('button', { name: 'Map activity' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to reach Blockscout');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(window.location.hash).toBe(`#${SAMPLE_ADDRESS}`);
  });

  it('loads an address from the URL hash on start', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith(`/addresses/${SAMPLE_ADDRESS.toLowerCase()}`)) {
        return new Response(JSON.stringify({ hash: SAMPLE_ADDRESS, is_contract: false }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [], next_page_params: null }), { status: 200 });
    });
    window.location.hash = `#${SAMPLE_ADDRESS}`;
    render(<App />);
    expect(await screen.findByText('No stars to show')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
    expect(screen.getByLabelText('Ethereum address or ENS name')).toHaveValue(SAMPLE_ADDRESS);
  });
});
