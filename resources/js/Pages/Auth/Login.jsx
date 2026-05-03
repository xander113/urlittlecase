import React, { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client'
import * as $ from 'jquery';
import { GetErrImage, GetErrorMsg, QuoteOfTheDay, sparkNotification } from '../../Grabs.jsx';
import { createInertiaApp, Link, usePage } from '@inertiajs/react';
// import { InertiaProgress } from '@inertiajs/progress';
import Layout from '../../Root.jsx';
import { Inertia } from '@inertiajs/inertia';
import { Col, Row, notification } from 'antd';

const csrf = document.querySelector('meta[name="csrf-token"]').content;

const appName = document.querySelector('meta[name="app-name"]').content;

export default function Login({}) {

    const auth = usePage().props;

    const [loading, setLoading] = useState({state: true});
    const [error, setError] = useState({active: false, type: null, message: null});
    const [user, setUser] = useState({active: false, person: []});
    const [api, contextHolder] = notification.useNotification();

    useEffect(()=>{

    }, []);

    // <span class="invalid-feedback" role="alert">
    //     <strong>{{ $message }}</strong>
    // </span>

    const ControlAction = (e) => {
        setLoading({state: true});
        const formData = new FormData(e);
        var error = false;
        fetch(`/auth/login`, {method: `POST`, body: formData, headers: {'X-CSRF-TOKEN': csrf}}).then(res => {
            //this is before fetch recieves the server-side data.
            if (!res.ok) {
                error = true;
            } 
            return res.json()
        }).then(res => {

            if (error) {
                // setError({message: res.message, active: true, type: `error`});
                sparkNotification(api, `error`, `Oops!`, res.message);
                return;
            }

            setLoading({state: false});

            // setError({message: `Success! Redirecting to your profile...`, active: true, type: `success`});
            sparkNotification(api, `success`, `Nice!`, `Success! Redirecting to the home page...`);

            setTimeout(()=>{Inertia.visit(`/`, {method: `GET`})}, 2000)

        }).catch(error=>console.log(error));
        return;
    }

    return(
        <Layout contextHolder={contextHolder}>
        {/* <MUI.Snackbar open={error.active} autoHideDuration={6000} onClose={(e)=>{setError({...error, active: false});}}>
            <MUI.Alert onClose={(e)=>{setError({...error, active: false});}} severity={error.type} className={`no-shadow`}>
                {error.message}
            </MUI.Alert>
        </MUI.Snackbar> */}
        <div class="container mt-4">
            <div class="flex flex-col flex-wrap justify-center content-center align-middle">
                <div className={`w-100`}>
                <div class="card">
                    <div class="card-header">Login</div>
                    <div class="card-body flex justify-center">
                        <form method="POST" onSubmit={(e)=>{e.preventDefault();ControlAction(e.target);}}>
                            <div class="row mb-3">
                                <label for="email" class="col-md-4 col-form-label text-md-end">Email</label>
                                <div class="col-md-6">
                                    <input id="email" type="email" class="form-control" name="email" required autocomplete="email" autofocus/>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <label for="password" class="col-md-4 col-form-label text-md-end">Password</label>

                                <div class="col-md-6">
                                    <input id="password" type="password" class="form-control" name="password" required autocomplete="current-password"/>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-md-6 offset-md-4">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" name="remember" id="remember"/>

                                        <label class="form-check-label" for="remember">
                                            Remember Me!
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div class="row mb-0">
                                <div class="col-md-8 offset-md-4">
                                    <button type="submit" class="btn btn-primary button is-green mr-5">
                                        Login
                                    </button>

                                    <Link class="btn btn-link" href="/register">
                                        Need to register?
                                    </Link>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
                </div>
            </div>
        </div>
        </Layout>
    );
}
