import React from 'react'
const MessageBlock = (props: { key?: number, message: string, direction: string }) => {
  return (
    <div className='w-full'>
      {
        props.direction == "left" ?
          <div className='float-left ml-5 rounded-full bg-black text-white px-4 py-1'>
            {props.message}
          </div>
          :
          <div className='float-right mr-5 rounded-full bg-black text-white px-4 py-1'>
            {props.message}
          </div>
      }

    </div>
  )
}
export default MessageBlock