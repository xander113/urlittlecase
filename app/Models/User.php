<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public function GetStream() {

        $stream = Stream::where('channel_id', $this->id)->first();

        if (!$stream) {return false;}

        return $stream;

    }

    public function IsLive() {

        $stream = Stream::where('channel_id', $this->id)->first();

        if (!$stream) {return false;}

        return $stream->live;

    }

    public function GetFollowers($count) {

        if ($count) {
            $followers = count(Follow::where('channel_id', $this->id)->get()->toArray());
        }else{
            $followers = Follow::where('channel_id', $this->id)->paginate(15);
        }

        return $followers;

    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'email',
        'email_verified_at',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];
}
