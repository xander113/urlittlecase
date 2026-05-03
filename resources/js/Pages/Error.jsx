import React, { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client'
import * as $ from 'jquery';
// import * as MUI from '@mui/material';
import { GetErrImage, GetErrorMsg, QuoteOfTheDay } from '../Grabs.jsx';
import { createInertiaApp, Link, usePage } from '@inertiajs/react';
// import { InertiaProgress } from '@inertiajs/progress';
import Layout from '../Root.jsx';
//

const csrf = document.querySelector('meta[name="csrf-token"]').content;

const appName = document.querySelector('meta[name="app-name"]').content;

export default function ErrorPage() {

    const auth = usePage().props;
    const status = auth.status;

    const [error, setError] = useState({errorType: status, message: GetErrorMsg(status)});
    const [image, setImage] = useState({loading: true, image: GetErrImage(status)});

    useEffect(()=>{

        setImage({...image, loading: false})

    }, []);

    return(
        <Layout option={`no-options`}>
            <div className={`mx-auto relative flex flex-col flex-wrap justify-center align-middle text-center mt-10`}>
                {/* <img src={image.image} className={`mb-3 self-center error-img straight-border drop-shadow-md`} style={{width: `250px`, height: `250px`, objectFit: `cover`, borderRadius: `4px`}}/> */}
                <p class="text-4xl font-bold mb-3">SORRY! {error.errorType}.</p>
                <p class="text-md mb-3">{error.message}</p>
            </div>
        </Layout>
    );
}
