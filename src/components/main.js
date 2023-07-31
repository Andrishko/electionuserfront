import React, { createRef, useEffect, useState } from 'react';
import axios from 'axios';
import { KJUR, KEYUTIL, verify, fromPem, b64nltohex, b64toutf8 } from 'jsrsasign';
import CryptoJS from 'crypto-js';


const Main = () => {
  let name = createRef()
  let password = createRef()
  const [signature, setSignature] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [responseData, setResponseData] = useState(null);
  const [data, setData] = useState(null);
  const [vote, setVote] = useState(false);
  const [voteState, setVoteState] = useState('');
  const [choose, setChoose] = useState('');
  const [uniqc, setUniq] = useState('');
  const [uniqr, setUnir] = useState('');
  const [keyc, setKey] = useState('');
  const [statusv, setStatusv] = useState('можете голосувати');
  const [status, setStatus] = useState('внесіть данні');

  // Функція для дешифрування зашифрованого рядка з використанням AES
  function decryptAES(ciphertext, key) {
    // Перетворення ключа на формат, який приймає AES
    const formattedKey = CryptoJS.enc.Utf8.parse(key);

    // Дешифрування зашифрованого рядка
    const decrypted = CryptoJS.AES.decrypt(ciphertext, formattedKey, {
      mode: CryptoJS.mode.ECB, // Режим шифрування
      padding: CryptoJS.pad.Pkcs7, // Схема вирівнювання
    });

    // Повертаємо розшифроване повідомлення у вигляді рядка
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  function generateRandomString(length) {
    var characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var randomString = '';

    for (var i = 0; i < length; i++) {
      var randomIndex = Math.floor(Math.random() * characters.length);
      randomString += characters.charAt(randomIndex);
    }

    return randomString;
  }

  function encryptAES(message, key) {
    // Перетворення ключа на формат, який приймає AES
    const formattedKey = CryptoJS.enc.Utf8.parse(key);

    // Шифрування повідомлення
    const encrypted = CryptoJS.AES.encrypt(message, formattedKey, {
      mode: CryptoJS.mode.ECB, // Режим шифрування
      padding: CryptoJS.pad.Pkcs7, // Схема вирівнювання
    });

    // Повертаємо зашифроване повідомлення у вигляді рядка
    return encrypted.toString();
  }

  function digit_sign (data) {
    const keyPair = KEYUTIL.generateKeypair('RSA', 2048);
    // Convert data to string
    const dataString = JSON.stringify(data);
    // Encode data to base64
    const encodedData = btoa(dataString);
    // Create a new Signature object with SHA256withRSA algorithm
    const sig = new KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
    // Initialize the signature object with the private key
    sig.init(keyPair.prvKeyObj);
    // Update the signature object with the encoded data
    sig.updateString(encodedData);
    // Generate the signature
    const signature = sig.sign();
    // Public key in PEM format
    const publicKeyPem = KEYUTIL.getPEM(keyPair.pubKeyObj);
    // Data to send in the AJAX request

    return {
      data: encodedData,
      signature: signature,
      publicKey: publicKeyPem,
    }
  }



  let signAndSend = async (event) => {
    event.preventDefault();

    const data = {
      name: name.current.value,
      password: password.current.value,
    }
    await axios.put('http://127.0.0.1:9583/check/', { name: name.current.value }).then(
      response => {
        
        if (response.data.value == 'aproved') {
          let sign = digit_sign(data)

          const dataToSend = {
            data: sign.data,
            signature: sign.signature,
            publicKey: sign.publicKeyPem,
          };
          axios.post('http://127.0.0.1:8000/api/send_bulletin', dataToSend)
            .then(response => {
              console.log('Data sent successfully.', response);
              if (response.data['valid'] == "you voted") {
                setStatus('ви брали участь в голосуванні')
                return true
              }
              if (response.data['value'] == "timeoff") {
                setStatus('голосування завершено')
                return true
              }
              axios.put('http://127.0.0.1:9583/counter/', response.data).then(response => {
                setStatus('можете голосувати')
                console.log(response)
                setVoteState(response.data)
                console.log(voteState);
              })
            })
        }
        else
          setStatus('ви брали участь в голосуванні')
      }
    )
  }

  let sendVote = async (event) => {
    event.preventDefault();
    let code = (voteState.data.token + choose).toString();
    let key = generateRandomString(16)
    let uniq = encryptAES(code, key)
    let ccode = encryptAES(uniq + ' ' + choose, voteState.data.key)
    const data = {
      voting: voteState.data.vote[0].id,
      token: voteState.data.token,
      ccode: ccode,
      uniq: uniq,
      vote: 'yes',
    }
    setUniq(uniq)
    setKey(key)
    let sign = digit_sign(data)
    const dataToSend = {
      data: sign.encodedData,
      signature: sign.signature,
      publicKey: sign.publicKey,
      codeVote: uniq,
    };
    await axios.post('http://127.0.0.1:8000/api/vote', dataToSend).then(response => {
      setUnir(response.data.code);
      setStatusv(response.data.status);
    })
  }

  let goVote = (event) => {
    event.preventDefault()
    setVote(true)
  }

  const handleCandidateChange = (event) => {
    event.preventDefault();
    setChoose(event.target.value);
  };

  const keyStyle = {
    width: '500px'
  }

  if (!vote) {
    return (
      <div>
        <form>
          <label>
            Name:
            <input type="text" ref={name} />
          </label>
          <label>
            Password:
            <input type="text" ref={password} />
          </label>
          <button type="button" onClick={signAndSend}>Підписати та надіслати</button>
        </form>
        <button onClick={goVote}>GO vote</button>
        <p>status: {status}</p>
      </div>
    );

  }
  else {
    let Candidate = voteState.data.candidates.map((candidate, index) => {
      return (
        <label>

          <input
            type="radio"
            name={candidate.name}
            value={candidate.name}
            checked={choose === candidate.name}
            onChange={handleCandidateChange}
          />
          {candidate.name}
        </label>
      )
    })
    return (
      <div style={keyStyle}>
        <p>{voteState.data.vote[0].name}</p>

        <form action="">
          {Candidate}
          <button onClick={sendVote}>Send Vote</button>
        </form>
        <p>Selected candidate: {choose}</p>
        <p >Статус голосування: {statusv}</p>
        <p >uniq: {uniqc}</p>
        <p >uniq response: {uniqr}</p>
        <p>key: {keyc}</p>
      </div>
    )
  }
}

export default Main;
