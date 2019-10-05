import * as React from 'react';
import { Button, KIND, SIZE } from 'baseui/button';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
  FocusOnce,
} from 'baseui/modal';

import File from './File'
import URL from './URL';
const csv2geojson = require('csv2geojson');

export default function (props) {
  const [isOpen, setOpen] = React.useState(false);
  const { urlCallback, toggleOpen } = props;
  return (
    <React.Fragment>
      <Button
        kind={KIND.secondary} size={SIZE.compact}
        onClick={() => {
          setOpen(s => !s); // or s === isOpen
          typeof toggleOpen === 'function' && toggleOpen()
        }}>Add data</Button>
      <Modal
        onClose={() => {
          typeof (toggleOpen) === 'function' && toggleOpen()
          setOpen(false);
        }}
        isOpen={isOpen}>
        <ModalHeader>Add Data</ModalHeader>
        <ModalBody>
          <FocusOnce>
            <URL urlCallback={(url) => {
              setOpen(false);
              typeof (urlCallback) === 'function'
                && urlCallback(url)
            }} />
          </FocusOnce>
          <File contentCallback={({ text, name }) => {
            if (name && (name.split(".")[1].match(/geo/) //test.json
              || name.split(".")[1].match(/json/))) {
              try {
                const json = JSON.parse(text);
                typeof (urlCallback) === 'function'
                  && urlCallback(null, json)
                setOpen(false);
              } catch (e) {
                console.log(e);
              }
            } else {
              // err has any parsing errors
              csv2geojson.csv2geojson(text, (err, data) => {
                if (!err) {
                  typeof (urlCallback) === 'function'
                    && urlCallback(null, data)
                }
              });
            }
          }} />
        </ModalBody>
        <ModalFooter>
          <ModalButton onClick={() => {
            setOpen(false);
            typeof (toggleOpen) === 'function' && toggleOpen();
          }}>Close</ModalButton>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
}