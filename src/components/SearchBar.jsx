import { useState } from 'react'

export default function SearchBar({ onSearch }) {
  const [value, setValue] = useState('')

  function submit(e) {
    e.preventDefault()
    onSearch(value)
  }

  return (
    <form className="search-bar" onSubmit={submit}>
      <input
        type="text"
        value={value}
        autoFocus
        placeholder="Type pinyin — e.g. shi, hao, ni"
        onChange={(e) => {
          setValue(e.target.value)
          onSearch(e.target.value)
        }}
      />
      <button type="submit">Search</button>
    </form>
  )
}
