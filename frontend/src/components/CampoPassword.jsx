import React, { useState } from 'react';

const REGLAS = [
  { texto: '8 caracteres', cumple: (p) => p.length >= 8 },
  { texto: 'A-Z', cumple: (p) => /[A-Z]/.test(p) },
  { texto: 'a-z', cumple: (p) => /[a-z]/.test(p) },
  { texto: '123', cumple: (p) => /[0-9]/.test(p) },
  { texto: '@#$', cumple: (p) => /[^A-Za-z0-9]/.test(p) }
];

// IF cumple 2 o menos reglas -> Débil / IF cumple 3 o 4 -> Media / ELSE (5) -> Fuerte
function nivelDeFortaleza(cumplidas) {
  if (cumplidas <= 2) return { clase: 'debil', texto: 'Débil' };
  if (cumplidas <= 4) return { clase: 'media', texto: 'Media' };
  return { clase: 'fuerte', texto: 'Fuerte' };
}

const IconoOjo = ({ tachado }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
    {tachado && <line x1="3" y1="3" x2="21" y2="21" />}
  </svg>
);

export default function CampoPassword({
  etiqueta = 'Contraseña',
  value,
  onChange,
  mostrarFuerza = true,
  required = true,
  autoComplete = 'new-password'
}) {
  const [visible, setVisible] = useState(false);

  const cumplidas = REGLAS.filter((r) => r.cumple(value)).length;
  const { clase, texto } = nivelDeFortaleza(cumplidas);
  const hayTexto = value.length > 0;

  return (
    <div className="campo">
      <label>{etiqueta}</label>

      <div className="pass-wrap">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="pass-ojo"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <IconoOjo tachado={visible} />
        </button>
      </div>

      {mostrarFuerza && (
        <>
          <div className="pass-fuerza-top">
            <span>Fortaleza de la contraseña</span>
            <span className={`pass-nivel ${hayTexto ? clase : ''}`}>{hayTexto ? texto : '—'}</span>
          </div>

          <div className="pass-barra">
            <div
              className={`pass-barra-relleno ${clase}`}
              style={{ width: hayTexto ? `${(cumplidas / REGLAS.length) * 100}%` : '0%' }}
            />
          </div>

          <div className="pass-reglas">
            {REGLAS.map((r) => (
              <span key={r.texto} className={`pass-regla ${r.cumple(value) ? 'ok' : ''}`}>
                <i className="pass-punto" />
                {r.texto}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}