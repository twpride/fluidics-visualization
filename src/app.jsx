import React, { useState, useEffect, useReducer } from 'react';
import Dashboard from './dashboard'

import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import {ArcInfo} from './arcInfo' 
import {runScript} from './generateVis'

let drawing;
let canvasTranform, offset, p

const EDIT_ARC_GEOM = 'EDIT_ARC_GEOM'
export const EDIT_ARC_PARAMS = 'EDIT_ARC_PARAMS'
const REC_POLYS = 'REC_POLYS'
const INIT_LINE = 'INIT_LINE'
const INIT_VALVE = 'INIT_VALVE'
const DEL_ARC = 'DEL_ARC'
const ADD_TO_NODE = 'ADD_TO_NODE'
const DEL_FROM_NODE = 'DEL_FROM_NODE'
const ADD_FOCUS_ARC = 'ADD_FOCUS_ARC'
const DEL_FOCUS_ARC = 'DEL_FOCUS_ARC'
const CLEAR_FOCUS_ARC = 'CLEAR_FOCUS_ARC'
const REC_ARCS = 'REC_ARCS'


const initLine = (elem) => ({
  id: elem.node.id,
  type: 'line',
  svgHandle: elem,
  name: elem.node.id,
  geom: elem.array().valueOf(),
  volume: 90,
  initState: [["HPLC", 90]],
  connections: [{},{}],
})

const initValve = (elem) => ({
  id: elem.attr().id,
  type: 'valve', 
  name: elem.attr().id,
  geom: [[elem.attr().cx, elem.attr().cy]],
  volume: 25,
  initState: [],
  connections: [{}],
  config: [...Array(25).keys()].map(x=>({id:x,text:'plugged'})),
  svgHandle: elem,
})

const updateNeighbors = ({arcs,nodes}, coord, ignore) => {

  for (let arcId of nodes[coord].arcs) {
    if (arcId === ignore) continue
    arcs = {
      ...arcs,
      [arcId]:{
        ...arcs[arcId],
        connections:[
          ...arcs[arcId].connections
        ]
      }
    }

    let idx
    if (arcs[arcId].type === 'valve') {
      idx = 0
    } else {
      idx = coord.toString()===arcs[arcId].geom[0].toString() ? 0:1
    }

      const resObj = {}
      
      nodes[coord].arcs
        .filter(e => e!==arcId)
        .forEach( 
          (e) => Object.assign(resObj,{[arcs[e].name]:e})
        )
      arcs[arcId].connections[idx] = resObj

    if (arcs[arcId].type === 'valve') {
      let newconf = [...arcs[arcId].config]
      // check connection for presence of each config
      for (let j = 0; j < newconf.length; j++) {
        if (newconf[j].text === "plugged") continue
        if (!Object.keys(arcs[arcId].connections[idx]).includes(newconf[j].text)) {

          newconf.splice(j, 1, { text: "plugged", id: 99 })

          newconf = newconf.map((val, idx) => ({ text: val.text, id: idx }))
        }
      }

      const configTxt = newconf.map(e => e.text).filter(txt => txt !== "plugged")
      const plugged_ele = newconf.filter(e => e.text === "plugged")
      // check config for presence of each connection
      for (let val of Object.keys(arcs[arcId].connections[idx])) {
        if (!configTxt.includes(val)) {
          const plugged_idx = plugged_ele.shift().id
          newconf.splice(plugged_idx, 1, { id: plugged_idx, text: val })
        }
      }

      arcs[arcId].config = newconf
    }
        
  }
  return arcs
}

const stateReducer = (state, [type, payload]) => {
  var newState
  switch (type) {
    case INIT_LINE:
      return {
        ...state,
        arcs: {
          ...state.arcs,
          [payload.node.id]: initLine(payload)
        }
      };
    case INIT_VALVE:
      return {
        ...state,
        arcs: {
          ...state.arcs,
          [payload.attr().id]: initValve(payload)
        }
      };
    case DEL_ARC:
      newState = {
        ...state,
        arcs: {
          ...state.arcs,
        }
      }
      delete newState.arcs[payload]
      return newState;
    case EDIT_ARC_GEOM:
      return {
        ...state,
        arcs: {
          ...state.arcs,
          [payload.arcId]:
          {
            ...state.arcs[payload.arcId],
            geom: payload.geom,
          }
        }
      };
    case EDIT_ARC_PARAMS:
      newState = {
        ...state,
        arcs: {
          ...state.arcs,
          [payload.id]: {
            ...state.arcs[payload.id],
            [payload.field]: payload.data
          }
        }
      }
      if (payload.field === 'name') {
        const nodes = newState.arcs[payload.id].type === 'valve'
          ? [0] : [0, newState.arcs[payload.id].geom.length - 1]
        nodes.forEach(e => {
          newState.arcs = updateNeighbors(
            newState,
            newState.arcs[payload.id].geom[e],
            payload.id
          )
        })
      }
      return newState

    case REC_POLYS:
      return {...payload ,  ui: { focusArc: [] }}
    case REC_ARCS:
      return {...state, arcs:payload}

    case ADD_TO_NODE:
      if (payload.coord in state.nodes) {
        newState = {
          ...state,
          nodes: {
            ...state.nodes,
            [payload.coord]: {
              ...state.nodes[payload.coord],
              arcs: [...state.nodes[payload.coord].arcs, payload.arcId],
              valveArc: state.arcs[payload.arcId].type === 'valve'
                ? payload.arcId : state.nodes[payload.coord].valveArc
            }
          }
        }
      } else {
        newState = {
          ...state,
          nodes: {
            ...state.nodes,
            [payload.coord]: {
              id: payload.coord,
              arcs: [payload.arcId],
              valveArc: state.arcs[payload.arcId].type === 'valve'
                ? payload.arcId : null
            }
          }
        }
      }

      newState.arcs = updateNeighbors(newState, payload.coord)

      return newState

    case DEL_FROM_NODE:
      newState = {
        ...state,
        nodes: {
          ...state.nodes,
          [payload.coord]: {
            ...state.nodes[payload.coord],
            arcs: [...state.nodes[payload.coord].arcs],
            valveArc: state.arcs[payload.arcId].type === 'valve'
              ? null : state.nodes[payload.coord].valveArc
          }
        }
      }

      const idx = newState.nodes[payload.coord].arcs.indexOf(payload.arcId)
      newState.nodes[payload.coord].arcs.splice(idx, 1)

      newState.arcs = updateNeighbors(newState, payload.coord)
      if (newState.nodes[payload.coord].arcs.length === 0) {
        delete newState.nodes[payload.coord]
        return newState
      } else {
        return newState
      }

    case ADD_FOCUS_ARC:
      return {
        ...state,
        ui: {
          ...state.ui,
          focusArc: [...state.ui.focusArc, payload]
        }
      }

    case DEL_FOCUS_ARC:
      newState = [...state.ui.focusArc]
      const idx2 = newState.indexOf(payload)
      newState.splice(idx2, 1)
      return {
        ...state,
        ui: {
          ...state.ui,
          focusArc: newState
        }
      }
    case CLEAR_FOCUS_ARC:
      return {
        ...state,
        ui: {
          ...state.ui,
          focusArc: []
        }
      }
    default:
      return state;
  }
};

const App = () => {
  // https://dev.to/scastiel/react-hooks-get-the-current-state-back-to-the-future-3op2
  // https://overreacted.io/how-are-function-components-different-from-classes/
  // https://adamrackis.dev/state-and-use-reducer/

  const [store, dispatch] = useReducer(stateReducer, {arcs:{},nodes:{},ui:{focusArc:[]}});
  const [ignored, forceUpdate] = useReducer(x => x + 1, 0);
  const [configFile, setConfigFile] = useState('');
  const [scriptFile, setScriptFile] = useState('');

  window.store = store
  // window.configFile = configFile

  useEffect(() => {
    const noContext = document.getElementById('canvas');
    noContext.addEventListener('contextmenu', e => {
      e.preventDefault();
    });

    drawing = window.SVG('canvas').size('100%', '100%').panZoom({
      zoomFactor:1.05,
      zoomMin: 1,
      zoomMax: 3
    });

    const fileSelect = document.getElementById("fileSelect"),
    importfile = document.getElementById("import");

    fileSelect.addEventListener("click", function (e) {
      if (importfile) {
        importfile.click();
      }
    }, false);

    const scriptSelect = document.getElementById("scriptSelect"),
    importScript = document.getElementById("importScript");

    scriptSelect.addEventListener("click", function (e) {
      if (importScript) {
        importScript.click();
      }
    }, false);

    document.addEventListener('keydown', e => {
      if (e.keyCode === 27) {
        for (let geom of drawing.children()) {
          if (geom._memory
            && geom._memory._selectHandler
            && geom._memory._selectHandler.pointSelection.isSelected) {
            geom.fire('dblclick', { noDispatch: true })
          }
        }
        dispatch([CLEAR_FOCUS_ARC])
        forceUpdate()

      } else if (e.keyCode === 8) {
        for (let geom of drawing.children()) {
          if (geom._memory
            && geom._memory._selectHandler
            && geom._memory._selectHandler.pointSelection.isSelected) {

            geom.fire('dblclick', { noDispatch: true })
            if (geom.type !== 'circle') {
              dispatch([
                DEL_FROM_NODE, 
                { arcId: geom.node.id, coord: geom.array().valueOf()[0] }
              ])
              dispatch([
                DEL_FROM_NODE, 
                { 
                  arcId: geom.node.id, 
                  coord: geom.array().valueOf()[geom.array().valueOf().length - 1] 
                }
              ])
            } else {
              dispatch([DEL_FROM_NODE, 
                { arcId: geom.node.id, coord: [geom.attr().cx, geom.attr().cy] }])
            }
            dispatch([DEL_ARC, geom.node.id])
            geom.remove()
          }
        }
      }
    })

    canvasTranform = drawing.node.getScreenCTM().inverse();
    offset = { x: window.pageXOffset, y: window.pageYOffset };
    p = drawing.node.createSVGPoint();

    window.drawing = drawing;


  }, [])



  function getCoincidentPt(e) {
    if (e.button !== 2) return // early when not right click

    p.x = e.clientX - (offset.x - window.pageXOffset);
    p.y = e.clientY - (offset.y - window.pageYOffset)
    const newPt = p.matrixTransform(canvasTranform);

    // https://stackoverflow.com/questions/328107/how-can-you-determine-a-point-is-between-two-other-points-on-a-line-segment
    let arcArr = this.array().valueOf();
    let a = {}, b = {}

    for (let i = 0; i < arcArr.length - 1; i++) {
      // first point of segment
      a.x = arcArr[i][0]
      a.y = arcArr[i][1]
      // second point of segment
      b.x = arcArr[i + 1][0]
      b.y = arcArr[i + 1][1]

      const cross = (newPt.y - a.y) * (b.x - a.x) - (newPt.x - a.x) * (b.y - a.y)
      const dot = (newPt.x - a.x) * (b.x - a.x) + (newPt.y - a.y) * (b.y - a.y)
      const ab_squared = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)

      if (Math.abs(cross) / Math.sqrt(ab_squared) > 2) {
        continue
      }

      if (dot < 0) {
        continue
      }

      if (dot > ab_squared) {
        continue
      }

      arcArr.splice(i + 1, 0, [newPt.x, newPt.y])
      this.plot(arcArr);
      dispatch([EDIT_ARC_GEOM, {arcId:this.node.id, geom:arcArr}])

      // update control pts, no noticeable performance hit
      // there may be a better way to do this
      this.selectize(false, { deepSelect: true })
      this.selectize({ deepSelect: true })

      break
    }

  }

  function getDeletePt(e) {
    if (e.detail.event.button !== 2) {
      return // early when not right click
    }

    let arcArr = this.array().valueOf();
    const lastIdx = arcArr.length - 1
    const coord  = arcArr[e.detail.i]
    arcArr.splice(e.detail.i, 1)
    this.plot(arcArr);
    dispatch([EDIT_ARC_GEOM, {arcId:this.node.id, geom:arcArr}])

    if (e.detail.i===0) {
      dispatch([DEL_FROM_NODE, {arcId:this.node.id, coord:coord}])
      dispatch([ADD_TO_NODE, {arcId:this.node.id, coord:arcArr[0]}])
    } else if (e.detail.i === lastIdx) {
      dispatch([DEL_FROM_NODE, {arcId:this.node.id, coord:coord}])
      dispatch([ADD_TO_NODE, {arcId:this.node.id, coord:arcArr[lastIdx-1]}])
    }

    // update control pts, no noticeable performance hit
    // there may be a better way to do this
    this.selectize(false, { deepSelect: true })
    this.selectize({ deepSelect: true })
  }


  const attachLineHandlers = (geom, dispatch) => {
    geom.attr('stroke-width', 1)
        .attr('fill', 'none')
        .addClass('hover_line')
        .on('dblclick', (e) => {
            if (
              geom._memory === undefined
              || geom._memory._selectHandler === undefined
              || !geom._memory._selectHandler.pointSelection.isSelected
            ) {
              geom.stroke({color:'red'})
                .selectize({ deepSelect: true })
                .on('mousedown', getCoincidentPt.bind(geom))
                .on('point', getDeletePt.bind(geom))
                .on('dragStart', (e) => {
                    const arcArr = geom.array().valueOf()
                    dispatch([DEL_FROM_NODE, {arcId:geom.node.id, coord:arcArr[e.detail.pos]}])
                  }
                )
                .on('dragEnd', (e) => {
                    const arcArr = geom.array().valueOf()
                    dispatch([EDIT_ARC_GEOM, {arcId:geom.node.id, geom:arcArr}])
                    if (e.detail.pos === 0 || e.detail.pos === arcArr.length-1){
                      dispatch([ADD_TO_NODE, {arcId:geom.node.id, coord:arcArr[e.detail.pos]}])
                    }
                  }
                )
                dispatch([ADD_FOCUS_ARC, geom.node.id])
            } else {
              geom.stroke({color:'black'})
                .selectize(false, { deepSelect: true })
                .off('mousedown')
                .off('point')
                .off('dragEnd')
                .off('dragStart')             
                if (!e.detail || !e.detail.noDispatch) {
                  dispatch([DEL_FOCUS_ARC, geom.node.id])
                  }
            }
            if (!e.detail || !e.detail.noDispatch) {
              dispatch([EDIT_ARC_PARAMS,
                {
                  id:geom.node.id,
                  field:'svgHandle',
                  data:geom
                }
              ])
            }
          }
        )

  }

  const attachValveHandlers = (geom, dispatch) => {
    geom.fill('white')
        .stroke({ width: 1, color: 'red' })
        .back()
        .on('dblclick', (e) => {
          if (
            geom._memory === undefined
            || geom._memory._selectHandler === undefined
            || !geom._memory._selectHandler.pointSelection.isSelected
          ) {
            geom.radius(4)
                .stroke({ width: 2, color: 'green' })
                .selectize()
                .draggable({ snapToGrid: 10 })
                .on('dragstart', (e) => {
                  dispatch([
                    DEL_FROM_NODE,
                    {
                      arcId: geom.attr().id,
                      coord: [geom.attr().cx, geom.attr().cy]
                    }
                  ])
                })
                .on('dragend', (e) => {
                  const coord = [geom.attr().cx, geom.attr().cy]
                  dispatch([
                    EDIT_ARC_GEOM, 
                    { arcId: geom.node.id, geom: [coord] }
                  ])
                  dispatch([
                    ADD_TO_NODE,
                    { arcId: geom.attr().id, coord }
                  ])
                })

            dispatch([ADD_FOCUS_ARC, geom.node.id])

          } else {
            geom.radius(3)
                .stroke({ width: 1, color: 'red' })
                .selectize(false)
                .draggable(false)
                .off('dragstart')
                .off('dragend')

            if (!e.detail || !e.detail.noDispatch) {
              dispatch([DEL_FOCUS_ARC, geom.node.id])
            }
          }

          if (!e.detail || !e.detail.noDispatch) {
            dispatch([EDIT_ARC_PARAMS,
              {
                id: geom.node.id,
                field: 'svgHandle',
                data: geom
              }
            ])
          }
        })
  }

  const simulateClick = (event) => {
    let geom;
    const target = event.target

    const endDraw = (e) => {
      geom.id(Date.now())
      geom.draw('done');
      geom.off('drawstart');
      dispatch([INIT_LINE, geom])

      const arcArr = geom.array().valueOf()

      dispatch([ADD_TO_NODE, { arcId: geom.node.id, coord: arcArr[0] }])
      dispatch([ADD_TO_NODE, { arcId: geom.node.id, coord: arcArr[arcArr.length - 1] }])
    }

    if (target.value === "valve") {
      drawing.on('mousedown', (e) => {
        p.x = e.clientX - (offset.x - window.pageXOffset);
        p.y = e.clientY - (offset.y - window.pageYOffset)
        const newPt = p.matrixTransform(canvasTranform);
        let temp

        for (var i in newPt) {
          temp = newPt[i] % 10;
          newPt[i] -= (temp < 10 / 2 ? temp : temp - 10) + (temp < 0 ? 10 : 0);
        }

        geom = drawing.circle(6)
                      .id(Date.now())
                      .center(newPt.x, newPt.y)
        attachValveHandlers(geom, dispatch)
        drawing.off('mousedown')
        dispatch([INIT_VALVE, geom])
        dispatch([
          ADD_TO_NODE, 
          {
            arcId: geom.attr().id, 
            coord: [geom.attr().cx, geom.attr().cy]
          }
        ])
      })

    } else if (target.value === "line") {
      geom = drawing.polyline()
      geom.draw({ snapToGrid: 10 })
      attachLineHandlers(geom,dispatch)
      geom.on('drawstart', () => document.addEventListener('keydown', endDraw))

      geom.on('drawstop', () => document.removeEventListener('keydown', endDraw))

    } 
    else if (target.value === "export") {
      const replacer = (key, value) => {
        if ( key === 'svgHandle') {
          return undefined;
        }
        return value;
      }

      const blob = new Blob([JSON.stringify(store, replacer, 2)], {type : 'application/json'});
      var url = window.URL.createObjectURL(blob);
      var element = document.createElement('a');
      element.setAttribute('href', url);
      element.setAttribute('download', 'export.json');
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);      
    }
  }

  let reader = new FileReader();
  reader.onload =  (e) => loadBlob(e.target.result)
  const loadBlob = (blob) => {
    const preStore = JSON.parse(blob)
    for (let [key,obj] of Object.entries(preStore.arcs)){
      let geom
      if (obj.type !== "valve") {
        geom = drawing.polyline(obj.geom)
                      .id(key)

        attachLineHandlers(geom,dispatch)
      } else {
        geom = drawing.circle(6)
                      .center(...obj.geom[0])
                      .id(key)

        attachValveHandlers(geom,dispatch)
      }

      preStore.arcs[key].svgHandle = geom
    }
    dispatch([REC_POLYS, preStore])  
  }

  const selectAndLoadConfig = (e) => {
    setConfigFile(e.target.files)
    drawing.clear()
    reader.readAsText(e.target.files[0]);
  }

  const reloadConfig = () => {
    drawing.clear()
    reader.readAsText(configFile[0]);
  }


  let script = new FileReader();
  script.onload =  (e) => loadScript(e.target.result)
  const loadScript = (blob) => {
    const replacer = (key, value) => {
      if (key === 'svgHandle') {
        return undefined;
      }
      return value;
    }
    const runState = JSON.parse(JSON.stringify(store, replacer))
    setFrames(runScript(blob.split('\n'),runState,drawing))
  }

  const selectAndLoadScript = (e) => {
    setScriptFile(e.target.files)
    script.readAsText(e.target.files[0]);
  }

  const reloadScript = () => {
    drawing.last().clear()
    script.readAsText(scriptFile[0]);
  }

  const [frames, setFrames] = useState([])
  window.runScript = () => {setFrames(runScript(store,drawing))}
  const [value, setValue] = useState(50)

  const handleChange = (e) => {
    setValue(e.target.value)
    drawing.last().clear()
    drawing.svg(frames[e.target.value])
  }

  return (
    <div className="app-container">
      <div className="canvas-container">
      <div className="btn-group" id="area">
          <button id="button1" value='line' title="Add Line" onClick={simulateClick}>
            Add Line
          </button>
          <button id="button0" value='valve' title="Add Valve" onClick={simulateClick}>
            Add Valve
          </button>
          <button id="button4" value='export' title="Download Configuration" onClick={simulateClick}>
            Save
          </button>
          <button id="fileSelect">Load</button>
          <input type="file" id="import" onChange={selectAndLoadConfig}></input>
          <button id="button5" title="reload" onClick={reloadConfig}>
            Reload
          </button>
          <button id="scriptSelect">Load Script</button>
          <input type="file" id="importScript" onChange={selectAndLoadScript}></input>
          <button id="button6" title="reload" onClick={reloadScript}>
            Reload Script
          </button>
        </div>
        <div id="canvas">
        </div>
        <input type="range" min="0" max={frames.length} value={value} step="1" onChange={handleChange}/>



      </div>



      <div className="sidebar">

      <Dashboard arcArray={Object.values(store.arcs)} arcDispatch={dispatch} />
        <DndProvider backend={HTML5Backend} >
          <ArcInfo
            arcs={store.arcs}
            dispatch={dispatch}
            ui={store.ui}
          />
        </DndProvider>
      </div>

    </div>
  )
};

export default App;




