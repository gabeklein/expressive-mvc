import { Context } from '@expressive/mvc';
import { createContext, createElement, useContext } from 'react';

const Shared = createContext(new Context());

const useShared = () => useContext(Shared);

const createProvider = (value: Context, children?: JSX.Element) =>
  createElement(Shared.Provider, { key: value.id, value }, children);

export { createProvider, useShared };
export { useState, useEffect, useMemo } from 'react';