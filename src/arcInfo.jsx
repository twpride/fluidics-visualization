import './arcInfo.css'
import React, { useState, useCallback , useEffect} from 'react'
import { Card } from './card'
import update from 'immutability-helper'
import {EDIT_ARC_PARAMS} from './app'
const style = {
	width: 400,
}


export const ArcInfo = ({arcs,ui,dispatch}) => {
  const sel = ui.focusArc[ui.focusArc.length -1]
  const [cards, setCards] = useState(arcs[sel] && arcs[sel].config ? [...arcs[sel].config] : [])

  useEffect(() => {
    setCards(arcs[sel] && arcs[sel].config ? [...arcs[sel].config] : [])
  }, [ui,arcs,sel])

  const moveCard = useCallback(
    (dragIndex, hoverIndex) => {
      const dragCard = cards[dragIndex]
      
      const newdata =  update(cards, {
        $splice: [
          [dragIndex, 1],
          [hoverIndex, 0, dragCard],
        ],
      })
      setCards(newdata)
      dispatch([EDIT_ARC_PARAMS,
        {
          id:sel,
          field:"config",
          data: newdata
        }
      ])
    },
    [cards,dispatch,sel],
  )

  const renderCard = (card, idx) => {
    return (
      <Card
        key={card.id}
        index={idx}
        id={card.id}
        text={card.text}
        moveCard={moveCard}
      />
    )
  }
  

  return (

    <div className="draglist-container">
      <div className="numbering-container">
      {cards.map(
        (card, idx) => <div className="numbering-item">{idx}</div>
      )}
      </div>
      <div style={style}>{cards.map(
        (card, idx) => renderCard(card, idx)
      )}</div>
    </div>      
  )
}
