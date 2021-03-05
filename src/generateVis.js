const range = (start, stop, xstep = 1, ystep = 1) => {
  const a = [],
    b = [...start];

  const checkidx = xstep === 0 ? 1 : 0
  if (b[checkidx] < stop[checkidx]) {
    while (b[checkidx] < stop[checkidx]) {
      a.push([...b]);
      b[0] += xstep
      b[1] += ystep

    }
    return a;
  } else {
    while (b[checkidx] > stop[checkidx]) {
      a.push([...b]);
      b[0] += xstep
      b[1] += ystep
    }
    return a;
  }
}

const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)

const genEle = (fl, elength = 1) => {
  let xstep
  let ystep
  const res = []
  let i
  for (i = 0; i < fl.length - 1; i++) {
    const pointDist = dist(fl[i], fl[i + 1])
    xstep = fl[1 + i][0] === fl[i][0] ?
      0 : elength * (fl[i + 1][0] - fl[i][0]) / pointDist
    ystep = fl[1 + i][1] === fl[i][1] ?
      0 : elength * (fl[i + 1][1] - fl[i][1]) / pointDist


    res.push(...range(fl[i], fl[i + 1], xstep, ystep))
  }

  res.push(fl[i])
  return res
}

const sum = arr => arr.reduce((a, b) => a + b, 0)

const genSeg = (state, eleCount) => {
  const totalVol = sum(state.map(i => i[1]))
  const type = [],
    midIdx = []
  let segStartIdx = 0
  let segEleCount
  let i = 0

  for (; i < state.length - 1; i++) {
    segEleCount = Math.floor(state[i][1] / totalVol * (eleCount - state.length))
    segEleCount = segEleCount > 0 ? segEleCount : 1
    midIdx.push(Math.floor(segStartIdx + segEleCount / 2))
    segStartIdx += segEleCount
    type.push(...Array(segEleCount).fill(state[i][0]))
  }

  type.push(...Array(eleCount - segStartIdx).fill(state[i][0]))
  midIdx.push(Math.floor(segStartIdx + (eleCount - segStartIdx) / 2))
  return [type, midIdx]
}

const merge = function(first, second) {
  let f = 0
  let s = 0
  let c = 0
  const res = []
  while (f < first.length || s < second.length) {
    if (s === second.length || first[f] <= second[s]) {
      if (res[c - 1] !== first[f]) {
        res[c] = first[f]
        c += 1
      }
      f += 1
    }
    if (f === first.length || second[s] <= first[f]) {
      if (res[c - 1] !== second[s]) {
        res[c] = second[s]
        c += 1
      }
      s += 1
    }
  }
  return res
}

const cumsum = (arr) => {
  let acc = 0
  return arr.map(e => {
    acc += e
    return acc
  })
}

const getCumulativeVol = (path) => {
  const lineVolumes = []
  const lineStates = []
  for (let i = 0; i < path.length; i++) {
    const [line, downStNdIdx] = path[i]
    if (downStNdIdx !== 0) {
      lineStates.push(...line.initState)
    } else {
      lineStates.push(...line.initState.reverse())
    }
    lineVolumes.push(line.volume)
  }

  lineStates.push(['RXX', 10000000]) // ambient RXX is always last fluid in path

  const cumLineVols = cumsum(lineVolumes)
  const cumFluidVols = cumsum(lineStates.map(e => e[1]))
  const combinedVols = merge(cumLineVols, cumFluidVols)

  return [lineStates, cumLineVols, cumFluidVols, combinedVols]
}

export const runScript = (script, runState, drawing) => {


  const setPump = (aspVol) => runState.arcs[pumpId].volume += aspVol

  const wasteValveId = Object.values(runState.arcs)
    .find(e => e.type.toLowerCase() === 'valve' && e.name.toLowerCase() === 'waste').id

  const setValves = (valveStateName) => {
    const valveStates = runState.ValvePortMapping[valveStateName]

    for (let [vName, vId] of valves) {
      const config = runState.arcs[vId].config
      const name2Id = runState.arcs[vId].connections[0]
      runState.arcs[vId].initState = [name2Id[config[0].text]]
      const activeConnections = runState.arcs[vId].initState

      if (vName === 'rotary') {
        if (config[valveStates.Port].text !== "plugged") {
          activeConnections.push(
            name2Id[config[valveStates.Port].text]
          )
        }
      } else {
        const powered = valveStates.ValvePositions[parseInt(vName.slice(1)) - 1] 
          === "B" ? true : false
        
        if (config.length === 2 && powered) {
          activeConnections.push(name2Id[config[1].text])
        } else if (config.length === 3) {
          activeConnections.push(name2Id[config[powered ? 2 : 1].text])
        }
      }
    }
  }

  const dfsPath = (startId) => {
    const start = runState.arcs[startId]
    const downStNdIdx = runState.nodes[start.geom[0]].arcs.length === 1 ?
      start.geom.length - 1 : 0
    const stack = [
      [
        [start, downStNdIdx]
      ]
    ]

    while (stack.length) {
      const path = stack.pop()

      const [prevLine, nodeIdx] = path[path.length - 1]

      const node = runState.nodes[prevLine.geom[nodeIdx]]

      let arcIds = node.arcs

      if (node.valveArc) {
        let line = runState.arcs[node.valveArc]
        if (line.initState.includes(prevLine.id) && line.initState.length === 2) {
          arcIds = [line.initState[line.initState[0] === prevLine.id ? 1 : 0]]
        } else arcIds = []
      }

      for (let arcId of arcIds) {
        if (arcId === prevLine.id) continue
        const line = runState.arcs[arcId]

        const downStNdIdx = runState.nodes[line.geom[0]].arcs.includes(prevLine.id) ?
          line.geom.length - 1 : 0

        if (['supply','waste'].includes(line.type) 
          || (line.type === "sipper" && !elevatorUp)) {

          return [...path, [line, downStNdIdx]]
        } else {
          stack.push([...path, [line, downStNdIdx]])
        }
      }
    }
  }

  const mergeFluids = (tub) =>{
    let RXXVol = 0
    let bulkVol = 0
    for (let i of tub.initState){
      if (i[0]!=="") bulkVol+=i[1]
      else RXXVol+=i[1]
    }  

    tub.initState=[]

    if (bulkVol!==0) tub.initState.push(["Bulk_Fluid",bulkVol])  
    if (RXXVol!==0) tub.initState.push(["RXX",RXXVol])     
  }

  const updateState = (path) => {
    if (!path) return

    const [lineStates, cumLineVols, cumFluidVols, combinedVols] = getCumulativeVol(path)

    let i = 0
    let c = 0
    let d = 0
    let newSeg = []

    while (d < cumLineVols.length) {
      newSeg.push(
        [
          lineStates[c][0],
          i > 0 ? combinedVols[i] - combinedVols[i - 1] : combinedVols[i]
        ]
      )
      if (combinedVols[i] === cumFluidVols[c]) c += 1

      if (combinedVols[i] === cumLineVols[d]) {
        if (newSeg.length > 1) {
          for (let j = newSeg.length - 2; j >= 0; j--) {
            if (newSeg[j][0] === newSeg[j + 1][0]) {
              newSeg[j][1] = newSeg[j][1] + newSeg[j + 1][1]
              newSeg.splice(j + 1, 1)
            }
          }
        }
        if (path[d][1] === 0) newSeg = newSeg.reverse()

        runState.arcs[path[d][0].id].initState = newSeg

        if (['pump','waste'].includes(runState.arcs[path[d][0].id].type)){
          mergeFluids(runState.arcs[path[d][0].id])
        }

        newSeg = []

        d += 1
      }

      i += 1
    }
  }

  const drawState = (arc, plot, dispPlot) => {
    if (arc.volume === 0) return 
    const elements = genEle(arc.geom, 10)
    const [type, midIdx] = genSeg(arc.initState, elements.length-1)
    const boundaryPts = [0]
  
    let j = 0
    for (; j < type.length - 1; j++) {
      if (type[j] !== type[j + 1]) boundaryPts.push(j+1)
    }
    boundaryPts.push(j+1)
  
    let factor, lw, prec
    if (['supply','waste'].includes(arc.type)){
      factor=1000
      lw=10
      prec = 3
    } else if (arc.type ==='pump'){
      factor=1
      lw=10
    } else {
      factor=1
      lw=2
    }

    for (j = 0; j < arc.initState.length; j++) {
      plot.polyline(elements.slice(boundaryPts[j], boundaryPts[j + 1] + 1))
          .stroke({ width: lw, color: reagents[arc.initState[j][0]].color })
          .fill('none')
      if (dispPlot) {
        dispPlot.polyline(elements.slice(boundaryPts[j], boundaryPts[j + 1] + 1))
            .stroke({ width: 3, color: reagents[arc.initState[j][0]].color })
            .fill('none')      
      }
    }
  
    for (j = 0; j < midIdx.length; j++) {
      if (arc.type==='supply' && arc.initState[j][0]==='RXX') continue
      plot.text((arc.initState[j][1]/factor).toPrecision(prec))
          .font({ size: 10 })
          .move(...elements[midIdx[j]])
    }
  }

  const lineExecTable = {
    Valve: (param,genPlot,k)=>{
      setValves(param)
    },
    Pull: (param,genPlot,k)=>{
      setPump(parseInt(param))
      const path = dfsPath(pumpId)
      updateState(path)   

      plot.last().remove()
      const dispPlot = plot.group()
      path.forEach(([e,_]) => {
        if (e.type !== 'valve') {
          e.svgHandle.remove()
          const linePlot = plot.group()

          drawState(e, linePlot,dispPlot)
          e.svgHandle = linePlot
        }
      })
      plot.text((k+1).toString())
            .font({ size: 30 })
            .move(930,470)
      if (genPlot) res.push(plot.svg())
      dispPlot.remove()
    },
    Dispense: (param,genPlot,k)=>{
      const vId = wasteValveId
      const config = runState.arcs[vId].config
      const name2Id = runState.arcs[vId].connections[0]
      runState.arcs[vId].initState = [
        name2Id[config[0].text],
        name2Id[config[2].text]
      ]
      lineExecTable.Pull(-runState.arcs[pumpId].volume, genPlot,k)
      runState.arcs[vId].initState = [
        name2Id[config[0].text],
        name2Id[config[1].text]
      ]

    },
    ElevatorDown: ()=> elevatorUp = false,
    ElevatorUp: ()=> elevatorUp = true,
    Wait: ()=>{},
  }

  window.drawState = drawState

  const reagents = runState.reagents
  const plot = drawing.group()
  const res = []
  let elevatorUp = true


  const valves = []
  Object.values(runState.arcs)
    .filter(e => e.type.toLowerCase() === 'valve')
    .forEach(e => valves.push([e.name, e.id]))

  const pumpId = Object.values(runState.arcs)
    .find(e => e.type.toLowerCase() === 'pump').id



  Object.values(runState.arcs).forEach(e => {
    if (e.type.toLowerCase() !== 'valve') {
      if (e.svgHandle) e.svgHandle.remove()
      const linePlot = plot.group()
      drawState(e, linePlot)
      e.svgHandle = linePlot
      if (e.type.toLowerCase()==='supply' && e.name.toLowerCase()!=='RXX') {
        plot.text(e.name)
        .font({ size: 10 })
        .move(...e.geom[0])
        .rotate(90, ...e.geom[0])
        .dmove(0,-5)
      }
    }
  })
  



  plot.text('Initial')
  .font({ size: 30 })
  .move(930,470)

  res.push(plot.svg())   


  let k = 0
  while (k<script.length){
    const line=script[k].split(/\s+/)
    if (line.length===0) continue
    else if (line[0]==="LoopStart"){
      let endfound=false
      let j=0
      while (!endfound && k+j+1<script.length){
        j+=1
        const lineEnd=script[k+j].split(/\s+/)
        if (lineEnd[0]==="LoopEnd") endfound=true
      }

      for (let n=0; n<parseInt(line[1]); n++){
        for (let m=k+1; m<k+j+1; m++) {
          const line2 = script[m].split(/\s+/)
          if (n===0) {
            if (lineExecTable[line2[0]]) lineExecTable[line2[0]](line2[1],true,k)
          } else {
            if (lineExecTable[line2[0]]) lineExecTable[line2[0]](line2[1],false,k)
          }
        }
      }

      k=k+j+1    
      continue
    }
    if (lineExecTable[line[0]]) lineExecTable[line[0]](line[1],true,k)
    k+=1

  }

  return res
}