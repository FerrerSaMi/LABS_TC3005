import { useState } from 'react'
import './App.css'

const encryptionKey = 'byz9VFNtbRQM0yBODcCb1lrUtVVH3D3x'
const initializationVector = 'X05IGQ5qdBnIqAWD'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) {
    throw new Error('El resultado debe estar en formato hexadecimal.')
  }
  return new Uint8Array(hex.match(/.{2}/g).map((byte) => parseInt(byte, 16)))
}

async function getKey() {
  return window.crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionKey),
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encrypt(text) {
  const key = await getKey()
  const result = await window.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: encoder.encode(initializationVector) },
    key,
    encoder.encode(text),
  )
  return bytesToHex(new Uint8Array(result))
}

async function decrypt(text) {
  const key = await getKey()
  const result = await window.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: encoder.encode(initializationVector) },
    key,
    hexToBytes(text.trim()),
  )
  return decoder.decode(result)
}

function App() {
  const [textToEncrypt, setTextToEncrypt] = useState('')
  const [encryptedText, setEncryptedText] = useState('')
  const [textToDecrypt, setTextToDecrypt] = useState('')
  const [decryptedText, setDecryptedText] = useState('')
  const [error, setError] = useState('')

  const handleEncrypt = async () => {
    try {
      setError('')
      setEncryptedText(await encrypt(textToEncrypt))
    } catch {
      setError('No se pudo cifrar el texto.')
    }
  }

  const handleDecrypt = async () => {
    try {
      setError('')
      setDecryptedText(await decrypt(textToDecrypt))
    } catch {
      setError('No se pudo descifrar. Revisa el texto hexadecimal.')
    }
  }

  return (
    <main className="container">
      <h1><em>LAB 4</em></h1>

      <section>
        <h2>Cifrar</h2>
        <input
          value={textToEncrypt}
          onChange={(event) => setTextToEncrypt(event.target.value)}
          placeholder="Escribe un texto"
        />
        <button onClick={handleEncrypt}>Cifrar</button>
        <input value={encryptedText} readOnly placeholder="Resultado" />
      </section>

      <section>
        <h2>Descifrar</h2>
        <input
          value={textToDecrypt}
          onChange={(event) => setTextToDecrypt(event.target.value)}
          placeholder="Pega el texto cifrado"
        />
        <button onClick={handleDecrypt}>Descifrar</button>
        <input value={decryptedText} readOnly placeholder="Resultado" />
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  )
}

export default App
