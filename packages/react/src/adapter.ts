import type {
  createContext,
  createElement,
  useContext,
  useState,
  useEffect,
  useMemo,
} from 'react';

interface Adapter {
  createElement: typeof createElement;
  createContext: typeof createContext;
  useContext: typeof useContext;
  useState: typeof useState;
  useEffect: typeof useEffect;
  useMemo: typeof useMemo;
}

export default {} as Adapter;