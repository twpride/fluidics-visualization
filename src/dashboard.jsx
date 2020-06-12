import React, { useState, useEffect} from 'react';
import './dashboard.css'
import { useTable } from 'react-table'
import {EDIT_ARC_PARAMS} from './app'

const EditableCell = ({
  value: initialValue,
  row: { index },
  column: { id , width},
  updateMyData
}) => {
  // debugger
  const [value, setValue] = useState(initialValue)

  const onChange = e => {
    setValue(e.target.value)
    e.stopPropagation()
  }
  
  const onBlur = () => {
    updateMyData(index, id, value)
  }

  // If the initialValue is changed external, sync it up with our state
  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return <input className={id} value={value} onChange={onChange} onBlur={onBlur} />
}

function Table({ columns, data, updateMyData,skipPageReset}) {

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,

  } = useTable(
    {
      columns,
      data,
      autoResetExpanded: !skipPageReset,
      updateMyData,
    },
  )



  return (
    <>
      <table {...getTableProps()}>
        <thead>
          {headerGroups.map(headerGroup => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <th width={column.width} {...column.getHeaderProps()}>{column.render("Header")}</th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {rows.map(
            (row, i) =>
              prepareRow(row) || (
                <tr {...row.getRowProps()}>
                  {row.cells.map(cell => {
                    // debugger
                    return (
                      <td style={{width:`${cell.column.width}px`}} {...cell.getCellProps()}>{cell.render("Cell")}</td>
                    );
                  })}
                </tr>
              )
          )}
        </tbody>
      </table>
    </>
  )
}

const HighlightButton = (props) => {
  const onClick = e => {
    props.value.fire('dblclick')
  }
  // debugger
  return <div className="selectBut" onClick={onClick}>
       {props.value._memory && props.value._memory._selectHandler  && props.value._memory._selectHandler.pointSelection.isSelected ? "\u2713":""}
  </div>
}

const Dashboard = ({arcArray, arcDispatch}) => {
  const columns = React.useMemo(
    () => [
      {
        Header: '#',
        accessor: (row, i) => i,
        width:20
      },
      {
        Header: '\u2713',
        accessor: 'svgHandle',
        Cell: HighlightButton,
        width:20
      },
      {
        Header: 'Name',
        Cell: EditableCell,
        accessor: 'name',
        width:120
      },
      {
        Header: 'Type',
        Cell: EditableCell,
        accessor: 'type',
        width:50
      },
      {
        Header: 'Volume',
        Cell: EditableCell,
        accessor: 'volume',
        width:50
      },
      {
        Header: 'State',
        Cell: EditableCell,
        id:'initState',
        accessor: (obj) => JSON.stringify(obj.initState).slice(1,-1),
        width:170
      },
    ],
    []
  )

  const [skipPageReset, setSkipPageReset] = React.useState(false)


  const updateMyData = (rowIndex, columnId, value) => {
    if (columnId === 'Connections') return


    if (columnId === 'volume' 
    && arcArray[rowIndex].type.toLowerCase() === "valve" 
    ) {
      
      const res = [...arcArray[rowIndex].config]

      if (parseInt(value) > res.length ) {
        for (let i= res.length; i<parseInt(value); i++) {
          res.push({id:res.length,text:'plugged'})
        }
      } else {
        for (let i= res.length-1; i>=0; i--) {
          if (res.length === parseInt(value)) break
          if (res[i].text === "plugged") res.splice(i,1)
        }

      }

      arcDispatch([EDIT_ARC_PARAMS,
        {
          id:arcArray[rowIndex].id,
          field:'config',
          data:res
        }
      ])
    }

    let copy = value
    if (columnId === 'volume') copy = JSON.parse(copy)
    if (columnId === 'initState') copy = JSON.parse(`[${copy}]`)
    arcDispatch([EDIT_ARC_PARAMS,
      {
        id:arcArray[rowIndex].id,
        field:columnId,
        data:copy
      }
    ])
  }

  // After data changes, we turn the flag back off
  // so that if data actually changes when we're not
  // editing it, the page is reset
  React.useEffect(() => {
    setSkipPageReset(false)
  }, [arcArray])

  return (

      <Table
        columns={columns}
        data={arcArray}
        updateMyData={updateMyData}
        skipPageReset={skipPageReset}
      />

  )

}

export default Dashboard