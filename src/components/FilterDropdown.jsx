const LABELS = { all: 'All moments', mine: 'My moments' };

export default function FilterDropdown({ value, onChange }) {
  function toggle() {
    onChange(value === 'all' ? 'mine' : 'all');
  }

  return (
    <button className="filter-toggle" onClick={toggle} type="button">
      <span className="filter-toggle__label">{LABELS[value]}</span>
      <svg
        className="filter-toggle__chevron"
        width="10"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
      >
        <path
          d="M1 1L5 5L9 1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
