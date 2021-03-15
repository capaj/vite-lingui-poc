// import process from 'process'
import React, { useState } from 'react'
import logo from './logo.svg'

import { Trans, t } from '@lingui/macro'
import { i18n } from '@lingui/core'
import './App.css'
import { I18nProvider } from '@lingui/react'
import { messages } from './locales/en/messages'
import * as plurals from 'make-plural/plurals'

i18n.loadLocaleData('en', { plurals: plurals.en })
i18n.load('en', messages)

i18n.activate('en')

function App() {
  const [count, setCount] = useState(0)
  const variable = 'My uber variable'
  // @ts-expect-error
  console.scope()
  return (
    <I18nProvider i18n={i18n}>
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <p>Hello Vite +++ React!</p>
          <p>
            <button onClick={() => setCount((count) => count + 1)}>
              {t`count is at: `}
              {count}
            </button>
          </p>
          <Trans>
            Edit <code>{variable}</code> and save to test HMR updates{' '}
            <strong>{variable}</strong>.
          </Trans>
          <p>
            <a
              className="App-link"
              href="https://reactjs.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn React
            </a>
            {' | '}
            <a
              className="App-link"
              href="https://vitejs.dev/guide/features.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vite Docs
            </a>
          </p>
        </header>
      </div>
    </I18nProvider>
  )
}

export default App
