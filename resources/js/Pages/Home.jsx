import React, { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client'
import * as $ from 'jquery';
import { GetErrImage, GetErrorMsg, publicImages, QuoteOfTheDay, sparkNotification } from '../Grabs.jsx';
import { createInertiaApp, Link, usePage } from '@inertiajs/react';
// import { InertiaProgress } from '@inertiajs/progress';
import Layout from '../Root.jsx';
//
import { notification } from 'antd';

const csrf = document.querySelector('meta[name="csrf-token"]').content;

const appName = document.querySelector('meta[name="app-name"]').content;

export default function Home({foo}) {

    const auth = usePage().props;

    const [loading, setLoading] = useState({state: true});
    const [error, setError] = useState({errorType: null, message: GetErrorMsg(null)});
    const [user, setUser] = useState({active: false, person: []});
    const [api, contextHolder] = notification.useNotification();
    const [images, setImages] = useState(publicImages);
    
    useEffect(()=>{
        // console.log(auth.recentShows);
        // setTimeout(()=>{sparkNotification(api, `info`, `Testing`, `This is the beta version of the website. Watch MFS GO LIVE!!`)}, 5000)
    }, []);

    return(
        <Layout contextHolder={contextHolder}>
            {/* <section class="banner" aria-label="Official website of the United States government"></section> */}
            {/* <section class="alert alert--warning">
                <div class="alert__body">
                    <h4 class="alert__heading">This site is currently <strong>under construction</strong>.</h4>
                    <p class="alert__text">
                        Thank you for your patience.
                    </p>
                </div>
            </section> */}
            <div class="relative mb-4 flex justify-center" id={`page-start`}>
                <div className={`section`}>
                    <div data-aos={`fade-down`} data-aos-duration={1000} className={`trifecta wow slideInLeft mx-auto relative flex flex-col flex-wrap justify-center align-middle text-center`}>
                        <p>Welcome, {auth.user.name}!</p>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
