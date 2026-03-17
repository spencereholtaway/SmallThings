export default function FilterDropdown({ value, onChange }) {
  return (
    <div className="filter-dropdown">
      <select
        className="filter-dropdown__select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">All moments</option>
        <option value="mine">My moments</option>
      </select>
    </div>
  );
}
