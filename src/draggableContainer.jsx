import React, { useState, useCallback } from 'react'
import { Card } from './Card'
import update from 'immutability-helper'
import {EDIT_ARC_PARAMS} from './app'
const style = {
	width: 400,
}


export const Container = ({row,dispatch, setSkipPageReset}) => {
	{
		const [cards, setCards] = useState([...row.original.config])
    // debugger
    // const cards  = row.original.config



		const moveCard = useCallback(
			(dragIndex, hoverIndex) => {
        setSkipPageReset(true)

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
            id:row.original.id,
            field:"config",
            data: newdata
          }
        ])

        


			},
			[cards],
		)

		const renderCard = (card, index) => {
			return (
				<Card
					key={card.id}
					index={index}
					id={card.id}
					text={card.text}
					moveCard={moveCard}
				/>
			)
		}

		return (
			<>
				<div style={style}>{cards.map((card, i) => renderCard(card, i))}</div>
			</>
		)
	}
}
