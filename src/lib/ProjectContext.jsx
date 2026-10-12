import { useReuse } from './ReuseContext';
import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { getMaterial, PIECE_COLORS } from './materials';
import { runStrategies } from './optimizationEngine.js';
import { activePlan } from './layoutSelection.js';
import { DEFAULT_PROJECT, DEMO_PROJECT, EXAMPLE_PIECES } from './demoData';

const ProjectContext = createContext(null);

let pieceCounter = 100;
function nextPieceId() {
  pieceCounter += 1;
  return `P${pieceCounter}`;
}

function makePiece(partial = {}) {
  return {
    id: partial.id || nextPieceId(),
    name: partial.name || 'New Piece',
    width: partial.width ?? 300,
    height: partial.height ?? 200,
    quantity: partial.quantity ?? 1,
    rotationAllowed: partial.rotationAllowed ?? true,
    color: partial.color || PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)],
  };
}

export function materialForReuse(stock, productions, currentMaterial) {
  if (!stock.length) throw new Error('Select at least one available offcut.');
  const first = stock[0];
  const matches = (m) => m?.type === first.materialType && Number(m.thickness) > 0 &&
    Number(m.thickness) === Number(first.thickness) &&
    ['grade','subtype'].every(key => m[key] === first[key]);
  if (!first.materialType || !Number.isFinite(Number(first.thickness)) || Number(first.thickness) <= 0 ||
    stock.some(o => o.status !== 'Available' || o.shape !== 'rectangle' ||
      !Number.isFinite(o.width) || o.width <= 0 || !Number.isFinite(o.height) || o.height <= 0 ||
      !matches({type:o.materialType,thickness:o.thickness,grade:o.grade,subtype:o.subtype}))) {
    throw new Error('Select available rectangular offcuts with the same material type, thickness and grade/subtype.');
  }
  const source = productions.find(p => p.projectId === first.sourceProjectId && matches(p.material))?.material;
  const configured = source ?? (matches(currentMaterial) ? currentMaterial : null);
  return {
    ...DEFAULT_PROJECT.material,
    ...(configured ?? {}),
    type:first.materialType,
    thickness:Number(first.thickness),
    grade:first.grade,
    subtype:first.subtype,
    sheetWidth:configured?.sheetWidth ?? '',
    sheetHeight:configured?.sheetHeight ?? '',
    pricePerSheet:configured?.pricePerSheet ?? '',
    sheetQuantity:0,
  };
}

export function ProjectProvider({ children }) {
  const {inventory,transact}=useReuse();
  const [projectId,setProjectId]=useState(()=>crypto.randomUUID());
  const [selectedOffcutIds,setSelectedOffcutIds]=useState([]);
  const selectedStock=inventory.offcuts.filter(o=>selectedOffcutIds.includes(o.id));
  const [projectName, setProjectName] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('scrapsmart_projects') || '[]');
      return saved[0]?.name || DEFAULT_PROJECT.name;
    } catch {
      return DEFAULT_PROJECT.name;
    }
  });
  const [material, setMaterial] = useState({ ...DEFAULT_PROJECT.material });
  const [pieces, setPieces] = useState([]);

  // Optimization Strategy Mode: 'most_efficient' | 'fastest'
  const [optimizationMode, setOptimizationMode] = useState('most_efficient');

  // Layout storage
  const [layout, setLayout] = useState(null); // Active selected mode layout
  const [efficientLayout, setEfficientLayout] = useState(null);
  const [fastestLayout, setFastestLayout] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [comparisons, setComparisons] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [validation, setValidation] = useState(null);

  // Comparison mode: 'baseline_vs_efficient' | 'baseline_vs_fastest' | 'efficient_vs_fastest'
  const [comparisonMode, setComparisonMode] = useState('baseline_vs_efficient');

  // Machine and Labor configuration
  const [assumptions, setAssumptions] = useState(/** @type {Record<string, string | number>} */ ({}));
  const laborRate=assumptions.laborRate ?? '';
  const setLaborRate=useCallback(value => setAssumptions(prev => ({...prev,laborRate:typeof value === 'function' ? value(prev.laborRate ?? '') : value})),[]);
  const [optimizationError,setOptimizationError] = useState(null);
  const [resultSignature,setResultSignature] = useState(null);
  const signature = JSON.stringify({projectId,material,pieces,assumptions,selectedOffcutIds,stock:selectedStock.map(o=>({
    id:o.id,width:o.width,height:o.height,materialType:o.materialType,thickness:o.thickness,
    grade:o.grade,subtype:o.subtype,shape:o.shape,
    usable:o.status==='Available' || (o.status==='Reserved' && o.reservedBy===projectId) || (o.status==='Used' && o.usedBy===projectId),
  }))});
  const signatureRef = useRef(signature);
  signatureRef.current = signature;
  const fresh = resultSignature === signature;
  useEffect(() => {setResultSignature(previous => previous === signature ? previous : null);},[signature]);
  const [machineType, setMachineType] = useState('manual_table_saw');

  const [activeSheetIndex,setActiveSheetIndex] = useState(0);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [viewMode, setViewMode] = useState('3d'); // 2d | 3d | split | compare | sequence
  const [step, setStep] = useState(1); // 1 Material, 2 Pieces, 3 Optimize, 4 Results
  const [optimizing, setOptimizing] = useState(false);
  const [isStale, setIsStale] = useState(false); // Flags when inputs changed after optimization

  const [savedProjects, setSavedProjects] = useState(() => {
    try {
      const records=JSON.parse(localStorage.getItem('scrapsmart_projects') || '[]').map(p=>({...p,id:p.id ?? crypto.randomUUID()}));
      localStorage.setItem('scrapsmart_projects',JSON.stringify(records));return records;
    } catch {
      return [];
    }
  });

  const matDef = getMaterial(material.type);

  // Whenever optimization mode changes and we already have results, update active layout
  const handleSetOptimizationMode = useCallback((mode) => {
    if (!['most_efficient','fastest'].includes(mode)) return;
    setOptimizationMode(mode);
    setActiveSheetIndex(0);
    if (mode === 'fastest' && fastestLayout) {
      setLayout(fastestLayout);
      setValidation(fastestLayout.validation);
    } else if (mode === 'most_efficient' && efficientLayout) {
      setLayout(efficientLayout);
      setValidation(efficientLayout.validation);
    }
  }, [fastestLayout, efficientLayout]);

  const runOptimization = useCallback((preferredMode) => {
    const activeMode = typeof preferredMode === 'string' ? preferredMode : optimizationMode;
    const requestSignature = signature;
    setOptimizationError(null);
    setOptimizing(true);

    setTimeout(() => {
      let results;
      try {
        const plans = runStrategies(material,pieces,assumptions,selectedStock,projectId);
        if (signatureRef.current !== requestSignature) { setOptimizing(false); return; }
        results = {efficient:plans.most_efficient,fastest:plans.fastest,baseline:plans.baseline,comparisons:null,recommendation:null};
        setResultSignature(requestSignature);
      } catch(error) { setOptimizationError(error.message || 'Optimization failed.');setOptimizing(false);return; }

      setEfficientLayout(results.efficient);
      setFastestLayout(results.fastest);
      setBaseline(results.baseline);
      setComparisons(results.comparisons);
      setRecommendation(results.recommendation);
      setIsStale(false);

      if (activeMode === 'fastest') {
        setLayout(results.fastest);
        setValidation(results.fastest.validation);
      } else {
        setLayout(results.efficient);
        setValidation(results.efficient.validation);
      }

      setSelectedInstanceId(null);
      setOptimizing(false);
      setStep(4);
    }, 60);
  }, [material, pieces, optimizationMode, laborRate, machineType, assumptions, signature, selectedStock, projectId]);

  const createIdea=useCallback(idea=>{
    const ids=[...new Set(idea.offcutIds ?? [])];
    const stock=ids.map(id=>inventory.offcuts.find(o=>o.id===id));
    if (stock.some(o=>!o)) throw new Error('Selected stock is missing. Refresh the Reuse Hub.');
    const nextMaterial=materialForReuse(stock,inventory.productions,material);
    signatureRef.current='';
    setProjectId(crypto.randomUUID());setProjectName(idea.name || 'Reuse Project');
    setMaterial(nextMaterial);setPieces((idea.pieces ?? []).map(makePiece));setSelectedOffcutIds(ids);
    setAssumptions({});setResultSignature(null);setOptimizationMode('most_efficient');
    setLayout(null);setEfficientLayout(null);setFastestLayout(null);setBaseline(null);
    setValidation(null);setComparisons(null);setRecommendation(null);setSelectedInstanceId(null);
    setActiveSheetIndex(0);setViewMode('3d');setOptimizationError(null);setOptimizing(false);setIsStale(false);
    setStep(1);
  },[inventory,material]);

  const loadDemo = useCallback(() => {
    const demoProjectId=crypto.randomUUID();
    setProjectId(demoProjectId);setSelectedOffcutIds([]);
    setProjectName(DEMO_PROJECT.name);
    setMaterial({ ...DEMO_PROJECT.material });
    setPieces(DEMO_PROJECT.pieces.map((p) => ({ ...p })));
    setLayout(null);
    setEfficientLayout(null);
    setFastestLayout(null);
    setBaseline(null);
    setValidation(null);
    setComparisons(null);
    setRecommendation(null);
    setSelectedInstanceId(null);
    setIsStale(false);
    setStep(2);

    setTimeout(() => {
      let results;
      try {
        const plans = runStrategies(DEMO_PROJECT.material,DEMO_PROJECT.pieces,assumptions);
        const demoSignature = JSON.stringify({projectId:demoProjectId,material:DEMO_PROJECT.material,pieces:DEMO_PROJECT.pieces,assumptions,selectedOffcutIds:[],stock:[]});
        if (signatureRef.current !== demoSignature) return;
        setResultSignature(demoSignature);
        results = {efficient:plans.most_efficient,fastest:plans.fastest,baseline:plans.baseline,comparisons:null,recommendation:null};
      } catch(error) { setOptimizationError(error.message || 'Demo optimization failed.');return; }

      setEfficientLayout(results.efficient);
      setFastestLayout(results.fastest);
      setBaseline(results.baseline);
      setComparisons(results.comparisons);
      setRecommendation(results.recommendation);
      setLayout(results.efficient);
      setValidation(results.efficient.validation);
      setOptimizationMode('most_efficient');
      setStep(4);
    }, 80);
  }, [assumptions]);

  const resetDemo = useCallback(() => {
    if (projectId) void transact({type:'release',projectId}).catch(()=>{});
    signatureRef.current = '';
    setProjectId(null);setSelectedOffcutIds([]);
    setProjectName(DEFAULT_PROJECT.name);
    setMaterial({ ...DEFAULT_PROJECT.material });
    setPieces([]);
    setLayout(null);
    setEfficientLayout(null);
    setFastestLayout(null);
    setBaseline(null);
    setValidation(null);
    setComparisons(null);
    setRecommendation(null);
    setSelectedInstanceId(null);
    setAssumptions({});
    setResultSignature(null);
    setOptimizationMode('most_efficient');
    setMachineType('manual_table_saw');
    setComparisonMode('baseline_vs_efficient');
    setActiveSheetIndex(0);
    setViewMode('3d');
    setOptimizationError(null);
    setOptimizing(false);
    setIsStale(false);
    setStep(1);
  }, [projectId,transact]);

  const addPiece = useCallback((partial) => {
    setPieces((prev) => [...prev, makePiece(partial)]);
    setIsStale(true);
  }, []);

  const updatePiece = useCallback((id, patch) => {
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setIsStale(true);
  }, []);

  const deletePiece = useCallback((id) => {
    setPieces((prev) => prev.filter((p) => p.id !== id));
    setIsStale(true);
  }, []);

  const duplicatePiece = useCallback((id) => {
    setPieces((prev) => {
      const src = prev.find((p) => p.id === id);
      if (!src) return prev;
      return [...prev, { ...src, id: nextPieceId(), name: `${src.name} copy` }];
    });
    setIsStale(true);
  }, []);

  const clearPieces = useCallback(() => {
    setPieces([]);
    setIsStale(true);
  }, []);

  const loadExample = useCallback(() => {
    setPieces(EXAMPLE_PIECES.map((p) => ({ ...p })));
    setIsStale(true);
  }, []);

  // Update material with staleness tracking
  const updateMaterial = useCallback((updater) => {
    setMaterial(updater);
    setIsStale(true);
  }, []);

  const saveProject = useCallback(() => {
    const savedProjectId = projectId ?? crypto.randomUUID();
    if (!projectId) setProjectId(savedProjectId);
    const proj = { id:savedProjectId, selectedOffcutIds, name: projectName, material, pieces, productionSettings:assumptions, savedAt: new Date().toISOString() };
    const updated = [proj, ...savedProjects.filter(p=>p.id!==savedProjectId)];
    setSavedProjects(updated);
    localStorage.setItem('scrapsmart_projects', JSON.stringify(updated));
    return proj;
  }, [projectName, material, pieces, savedProjects, assumptions, projectId, selectedOffcutIds]);

  const openProject = useCallback((proj) => {
    setProjectId(proj.id ?? crypto.randomUUID());setSelectedOffcutIds(proj.selectedOffcutIds ?? []);
    setAssumptions({...proj.productionSettings ?? {}});
    setProjectName(proj.name);
    setMaterial({ ...proj.material });
    const fallbackColor = getMaterial(proj.material?.type).three.color;
    setPieces(proj.pieces.map((p) => ({
      ...p,
      color: /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : fallbackColor,
    })));
    setResultSignature(null);
    setLayout(null);
    setEfficientLayout(null);
    setFastestLayout(null);
    setBaseline(null);
    setValidation(null);
    setComparisons(null);
    setRecommendation(null);
    setSelectedInstanceId(null);
    setIsStale(false);
    setStep(2);
  }, []);

  const deleteProject = useCallback((idx) => {
    setSavedProjects((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      localStorage.setItem('scrapsmart_projects', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({
      projectId,selectedOffcutIds,setSelectedOffcutIds,projectName, setProjectName,
      material, setMaterial: updateMaterial,
      matDef,
      pieces, setPieces,
      addPiece, updatePiece, deletePiece, duplicatePiece, clearPieces, loadExample,
      optimizationMode, setOptimizationMode: handleSetOptimizationMode,
      layout: activePlan({most_efficient:efficientLayout,fastest:fastestLayout},optimizationMode,resultSignature,signature), setLayout,
      efficientLayout: fresh ? efficientLayout : null, fastestLayout: fresh ? fastestLayout : null, baseline: fresh ? baseline : null,
      plans: fresh ? {baseline,most_efficient:efficientLayout,fastest:fastestLayout} : null,
      strategy:optimizationMode, setStrategy:handleSetOptimizationMode,
      assumptions,setAssumptions,optimizationError,
      comparisons, recommendation,
      validation: fresh ? (optimizationMode === 'fastest' ? fastestLayout?.validation : efficientLayout?.validation) : null,
      activeSheetIndex,setActiveSheetIndex,
      comparisonMode, setComparisonMode,
      laborRate, setLaborRate,
      machineType, setMachineType,
      selectedInstanceId, setSelectedInstanceId,
      viewMode, setViewMode,
      step, setStep,
      optimizing, isStale: !fresh,
      runOptimization, loadDemo, resetDemo,
      createIdea,savedProjects, saveProject, openProject, deleteProject,
    }),
    [
      projectId,selectedOffcutIds,projectName, material, updateMaterial, matDef, pieces,
      optimizationMode, handleSetOptimizationMode,
      layout, efficientLayout, fastestLayout, baseline,
      comparisons, recommendation, validation,
      comparisonMode, laborRate, machineType,
      selectedInstanceId, viewMode, step, optimizing, isStale, fresh, assumptions, optimizationError, activeSheetIndex, resultSignature, signature,
      runOptimization, loadDemo, resetDemo,
      createIdea,savedProjects, saveProject, openProject, deleteProject,
    ]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
