import React, {createContext,useContext,useState,useEffect,useCallback} from 'react';
import {INVENTORY_KEY,emptyInventory,inventoryTransition} from './reuseInventory.js';
const Context=createContext(null);
function read() { const raw=localStorage.getItem(INVENTORY_KEY); if(!raw)return emptyInventory(); const value=JSON.parse(raw); if(!Array.isArray(value.offcuts)||!Array.isArray(value.productions))throw new Error('Reusable inventory is damaged. Restore the browser data before updating stock.'); return value; }
export function ReuseProvider({children}) {
  const [inventory,setInventory]=useState(()=>{try{return read();}catch{return emptyInventory();}});
  useEffect(()=>{const refresh=()=>{try{setInventory(read());}catch{/* Never overwrite corrupt persisted data. */}};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);},[]);
  const transact=useCallback(async action=>{
    if(!navigator.locks)throw new Error('This browser cannot safely lock local inventory. Use a browser supporting Web Locks on localhost or HTTPS.');
    return navigator.locks.request(INVENTORY_KEY,()=>{const updated=inventoryTransition(read(),action);localStorage.setItem(INVENTORY_KEY,JSON.stringify(updated));setInventory(updated);return updated;});
  },[]);
  return <Context.Provider value={{inventory,transact}}>{children}</Context.Provider>;
}
export const useReuse=()=>useContext(Context);
